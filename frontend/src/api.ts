import type { InboxItem, ItemType, QueryResult } from "./types";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? response.statusText;
  } catch {
    return response.statusText;
  }
}

export async function ingest(type: ItemType, content: string): Promise<void> {
  const response = await fetch("/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, content }),
  });
  if (!response.ok) throw new Error(await readError(response));
}

export async function listItems(): Promise<{ items: InboxItem[]; mockAi: boolean }> {
  const response = await fetch("/items");
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<{ items: InboxItem[]; mockAi: boolean }>;
}

export async function queryInbox(question: string): Promise<QueryResult> {
  const response = await fetch("/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<QueryResult>;
}
