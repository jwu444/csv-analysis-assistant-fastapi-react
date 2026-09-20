from typing import Any

from pydantic import BaseModel, ConfigDict


class DatasetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    n_rows: int
    n_cols: int


class ChatCreateRequest(BaseModel):
    dataset_ids: list[str]


class ChatDatasetOut(BaseModel):
    id: str
    name: str


class ChatOut(BaseModel):
    id: str
    datasets: list[ChatDatasetOut]


class ChatRequest(BaseModel):
    question: str


class AnalystPassOut(BaseModel):
    model: str
    tokens_in: int
    tokens_out: int
    latency_ms: int
    cost_usd: float
    interpretation: str


class JudgePassOut(BaseModel):
    model: str
    tokens_in: int
    tokens_out: int
    latency_ms: int
    cost_usd: float
    score: int | None
    feedback: str
    gaps: list[str]


class PassTraceOut(BaseModel):
    pass_no: int
    analyst: AnalystPassOut
    charts: list[str]
    stats: list[dict[str, Any]]
    errors: list[str]
    judge: JudgePassOut
    revision_instruction: str


class MessageTraceOut(BaseModel):
    # Per-pass records only. The system prompt is intentionally excluded — it can
    # leak guardrail language, so it never leaves the backend.
    passes: list[PassTraceOut]


class ChatMessageOut(BaseModel):
    id: str
    role: str
    content: str
    charts: list[str] = []
    stats: list[dict[str, Any]] = []
    errors: list[str] = []
    # Per-pass loop trace (issue #9 review); None for user rows and pre-trace rows.
    trace: MessageTraceOut | None = None


class ChatHistoryOut(BaseModel):
    datasets: list[ChatDatasetOut]
    messages: list[ChatMessageOut]
