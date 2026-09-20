import pytest
from app.models import Analysis, Base, Chat, ChatDataset, ChatMessage, Dataset, DatasetColumn
from sqlalchemy import Numeric, create_engine, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker


def _session(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'm.db'}", future=True).execution_options(
        schema_translate_map={"app": None}
    )

    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)()


def test_dataset_persists_profile_and_csv(tmp_path):
    session = _session(tmp_path)
    dataset = Dataset(
        name="sales.csv",
        n_rows=3,
        n_cols=2,
        profile_json={"n_rows": 3, "columns": ["a", "b"]},
        data_csv="a,b\n1,2\n3,4\n5,6\n",
        content_hash="a" * 64,
    )
    session.add(dataset)
    session.commit()

    loaded = session.scalar(select(Dataset).where(Dataset.name == "sales.csv"))
    assert loaded is not None
    assert loaded.profile_json["n_rows"] == 3
    assert loaded.data_csv == "a,b\n1,2\n3,4\n5,6\n"


def test_chat_message_defaults(tmp_path):
    session = _session(tmp_path)
    dataset = Dataset(
        name="d.csv", n_rows=1, n_cols=1, profile_json={}, data_csv="x\n1\n", content_hash="b" * 64
    )
    session.add(dataset)
    session.flush()
    chat = Chat()
    session.add(chat)
    session.flush()
    session.add(ChatDataset(chat_id=chat.id, dataset_id=dataset.id, ordinal_position=0))
    msg = ChatMessage(chat_id=chat.id, role="user", content="hello")
    session.add(msg)
    session.commit()

    assert msg.tool_calls == []
    assert msg.tokens_in == 0
    assert msg.cost_usd == 0.0
    assert msg.latency_ms == 0


def test_analysis_uses_message_id_and_result_stats() -> None:
    cols = {c.name for c in Analysis.__table__.columns}
    assert "message_id" in cols
    assert "chat_message_id" not in cols
    assert "result_stats" in cols
    assert Analysis.__table__.c.result_stats.nullable is True


def test_dataset_columns_ordinal_and_unique() -> None:
    cols = {c.name for c in DatasetColumn.__table__.columns}
    assert "ordinal_position" in cols
    assert DatasetColumn.__table__.c.ordinal_position.nullable is False
    unique_cols = {
        tuple(sorted(col.name for col in c.columns))
        for c in DatasetColumn.__table__.constraints
        if c.__class__.__name__ == "UniqueConstraint"
    }
    assert ("dataset_id", "name") in unique_cols


def test_chat_datasets_ordinal_and_unique() -> None:
    cols = {c.name for c in ChatDataset.__table__.columns}
    assert "ordinal_position" in cols
    assert ChatDataset.__table__.c.ordinal_position.nullable is False
    unique_cols = {
        tuple(sorted(col.name for col in c.columns))
        for c in ChatDataset.__table__.constraints
        if c.__class__.__name__ == "UniqueConstraint"
    }
    assert ("chat_id", "dataset_id") in unique_cols


def test_chat_no_longer_has_dataset_id() -> None:
    assert "dataset_id" not in {c.name for c in Chat.__table__.columns}


def test_cost_usd_is_numeric() -> None:
    assert isinstance(ChatMessage.__table__.c.cost_usd.type, Numeric)


def test_chat_message_has_loop_metadata_columns(tmp_path) -> None:
    session = _session(tmp_path)
    chat = Chat()
    session.add(chat)
    session.flush()
    msg = ChatMessage(chat_id=chat.id, role="assistant", content="ok", pass_count=3, judge_score=85)
    session.add(msg)
    session.flush()

    fetched = session.get(ChatMessage, msg.id)
    assert fetched.pass_count == 3
    assert fetched.judge_score == 85


def test_fk_columns_are_indexed() -> None:
    assert DatasetColumn.__table__.c.dataset_id.index is True
    assert ChatMessage.__table__.c.chat_id.index is True
    assert Analysis.__table__.c.message_id.index is True
    assert ChatDataset.__table__.c.chat_id.index is True
    assert ChatDataset.__table__.c.dataset_id.index is True


def test_content_hash_unique_constraint(tmp_path):
    session = _session(tmp_path)
    session.add(
        Dataset(
            name="a.csv",
            n_rows=1,
            n_cols=1,
            profile_json={},
            data_csv="x\n1\n",
            content_hash="h" * 64,
        )
    )
    session.commit()
    session.add(
        Dataset(
            name="b.csv",
            n_rows=1,
            n_cols=1,
            profile_json={},
            data_csv="y\n2\n",
            content_hash="h" * 64,
        )
    )
    with pytest.raises(IntegrityError):
        session.commit()
