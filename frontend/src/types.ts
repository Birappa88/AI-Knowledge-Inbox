export type ItemType = "note" | "url";
export type ItemStatus = "processing" | "ready" | "failed";

export type InboxItem = {
  id: string;
  type: ItemType;
  title: string;
  source: string;
  status: ItemStatus;
  error: string | null;
  createdAt: string;
  chunkCount: number;
  preview: string;
};

export type QuerySource = {
  itemId: string;
  title: string;
  source: string;
  type: ItemType;
  snippet: string;
  score: number;
};

export type QueryResult = {
  answer: string;
  sources: QuerySource[];
};
