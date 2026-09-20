import type { ChatHistoryOut, ChatMessageOut, ChatOut, DatasetOut } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function failFrom(res: Response): Promise<never> {
  let detail = res.statusText || `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { detail?: unknown };
    if (typeof body.detail === "string") detail = body.detail;
  } catch {
    // Non-JSON error body — keep the status-based message.
  }
  throw new ApiError(res.status, detail);
}

export async function uploadDataset(file: File): Promise<DatasetOut> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/datasets`, { method: "POST", body: form });
  if (!res.ok) return failFrom(res);
  return res.json() as Promise<DatasetOut>;
}

export async function getDataset(id: string): Promise<DatasetOut> {
  const res = await fetch(`${API_BASE}/datasets/${id}`);
  if (!res.ok) return failFrom(res);
  return res.json() as Promise<DatasetOut>;
}

export async function listDatasets(): Promise<DatasetOut[]> {
  const res = await fetch(`${API_BASE}/datasets`);
  if (!res.ok) return failFrom(res);
  return res.json() as Promise<DatasetOut[]>;
}

export async function createChat(datasetIds: string[]): Promise<ChatOut> {
  const res = await fetch(`${API_BASE}/chats`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataset_ids: datasetIds }),
  });
  if (!res.ok) return failFrom(res);
  return res.json() as Promise<ChatOut>;
}

export async function getChatHistory(chatId: string): Promise<ChatHistoryOut> {
  const res = await fetch(`${API_BASE}/chats/${chatId}`);
  if (!res.ok) return failFrom(res);
  return res.json() as Promise<ChatHistoryOut>;
}

export async function postChat(chatId: string, question: string): Promise<ChatMessageOut> {
  const res = await fetch(`${API_BASE}/chats/${chatId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) return failFrom(res);
  return res.json() as Promise<ChatMessageOut>;
}
