export interface DatasetOut {
  id: string;
  name: string;
  n_rows: number;
  n_cols: number;
}

export interface ChatDatasetOut {
  id: string;
  name: string;
}

export interface ChatOut {
  id: string;
  datasets: ChatDatasetOut[];
}

export interface AnalystPassOut {
  model: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_usd: number;
  interpretation: string;
}

export interface JudgePassOut {
  model: string;
  tokens_in: number;
  tokens_out: number;
  latency_ms: number;
  cost_usd: number;
  score: number | null;
  feedback: string;
  gaps: string[];
}

export interface PassTraceOut {
  pass_no: number;
  analyst: AnalystPassOut;
  charts: string[];
  stats: Record<string, unknown>[];
  errors: string[];
  judge: JudgePassOut;
  revision_instruction: string;
}

export interface MessageTraceOut {
  passes: PassTraceOut[];
}

export interface ChatMessageOut {
  id: string;
  role: string;
  content: string;
  charts: string[];
  stats: Record<string, unknown>[];
  errors: string[];
  // Per-pass loop trace (issue #9 review); absent/null for user + pre-trace rows.
  trace?: MessageTraceOut | null;
}

export interface ChatHistoryOut {
  datasets: ChatDatasetOut[];
  messages: ChatMessageOut[];
}
