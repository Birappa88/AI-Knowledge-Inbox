export type ItemType = "note" | "url";
export type ItemStatus = "processing" | "ready" | "failed";

export type KnowledgeItem = {
  id: string;
  type: ItemType;
  title: string;
  source: string;
  rawContent: string;
  status: ItemStatus;
  error: string | null;
  createdAt: string;
};

export type ChunkRecord = {
  id: string;
  itemId: string;
  ordinal: number;
  text: string;
  embedding: number[];
};

export type RetrievedChunk = {
  chunkId: string;
  itemId: string;
  title: string;
  source: string;
  type: ItemType;
  snippet: string;
  score: number;
};
