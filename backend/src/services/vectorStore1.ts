import { chunkRepo } from "../db.js";
import type { RetrievedChunk } from "../types.js";
import { cosineSimilarity } from "./embeddings.js";

const DEFAULT_TOP_K = 5;
const MIN_SCORE = 0.12;

export function searchSimilar(queryEmbedding: number[], topK = DEFAULT_TOP_K): RetrievedChunk[] {
  const corpus = chunkRepo.listWithItems();
  const scored = corpus
    .map((chunk) => ({
      chunkId: chunk.id,
      itemId: chunk.itemId,
      title: chunk.title,
      source: chunk.source,
      type: chunk.type,
      snippet: chunk.text,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .filter((hit) => Number.isFinite(hit.score) && hit.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
