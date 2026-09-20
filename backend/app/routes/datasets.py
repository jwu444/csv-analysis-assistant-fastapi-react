from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.dataset_io import decode_csv, hash_csv, load_csv
from app.db import get_session
from app.models import Dataset, DatasetColumn
from app.profiler import profile_dataframe
from app.schemas import DatasetOut

router = APIRouter(prefix="/datasets", tags=["datasets"])


def _find_by_hash(session: Session, content_hash: str) -> Dataset | None:
    """Find a dataset by its content hash."""
    return session.execute(
        select(Dataset).where(Dataset.content_hash == content_hash)
    ).scalar_one_or_none()


@router.post("", response_model=DatasetOut)
def upload_dataset(
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
) -> Dataset:
    raw = file.file.read()
    if len(raw) > settings.max_upload_bytes:
        raise HTTPException(status_code=413, detail="File exceeds size limit")
    if not (file.filename or "").lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted")

    content_hash = hash_csv(raw)

    # Idempotent upload: known content short-circuits before any parsing/profiling.
    existing = _find_by_hash(session, content_hash)
    if existing is not None:
        return existing

    try:
        data_csv = decode_csv(raw)
        df = load_csv(data_csv)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Could not parse CSV: {exc}") from exc
    if df.empty:
        raise HTTPException(status_code=400, detail="CSV has no rows")
    if len(df) > settings.max_rows:
        raise HTTPException(status_code=413, detail="CSV exceeds row limit")

    dataset = Dataset(
        name=file.filename or "dataset.csv",
        n_rows=int(len(df)),
        n_cols=int(df.shape[1]),
        profile_json=profile_dataframe(
            df,
            sample_rows=settings.profile_sample_rows,
            max_cardinality=settings.profile_max_cardinality,
            max_corr_cols=settings.profile_max_corr_cols,
            top_corr_pairs=settings.profile_top_corr_pairs,
            token_budget=settings.profile_token_budget,
        ),
        data_csv=data_csv,
        content_hash=content_hash,
    )
    try:
        session.add(dataset)
        session.flush()
        for ordinal_position, col in enumerate(dataset.profile_json["columns"]):
            dataset_column = DatasetColumn(
                dataset_id=dataset.id,
                name=col["name"],
                ordinal_position=ordinal_position,
                inferred_type=col["dtype"],
                null_count=col["n_null"],
            )
            session.add(dataset_column)
        session.commit()
    except IntegrityError:
        # A concurrent upload won the race on the unique hash — return the winner.
        session.rollback()
        winner = _find_by_hash(session, content_hash)
        if winner is None:
            raise
        return winner
    session.refresh(dataset)
    return dataset


@router.get("", response_model=list[DatasetOut])
def list_datasets(session: Session = Depends(get_session)) -> list[DatasetOut]:
    # Project only the columns needed for DatasetOut — avoid hydrating data_csv
    # (raw CSV text, potentially multi-MB per row) and profile_json on this hot
    # path (the sidebar self-fetches on every AppShell mount).
    rows = session.execute(
        select(Dataset.id, Dataset.name, Dataset.n_rows, Dataset.n_cols).order_by(
            Dataset.created_at.desc()
        )
    ).all()
    return [DatasetOut(id=r.id, name=r.name, n_rows=r.n_rows, n_cols=r.n_cols) for r in rows]


@router.get("/{dataset_id}", response_model=DatasetOut)
def get_dataset(dataset_id: str, session: Session = Depends(get_session)) -> Dataset:
    dataset = session.get(Dataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset
