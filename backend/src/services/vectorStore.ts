
import { chunkRepo } from "../db.js";
import type { RetrievedChunk } from "../types.js";
import { config } from "../config.js";
import { cosineSimilarity } from "./embeddings.js";

const DEFAULT_TOP_K = 5;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1);
}

function keywordScore(query: string, text: string): number {
  const queryTerms = [...new Set(tokenize(query))];
  const chunkTerms = tokenize(text);

  if (queryTerms.length === 0 || chunkTerms.length === 0) {
    return 0;
  }

  const termCounts = new Map<string, number>();
  for (const term of chunkTerms) {
    termCounts.set(term, (termCounts.get(term) ?? 0) + 1);
  }

  const matchedTerms = queryTerms.filter((term) => termCounts.has(term));
  const coverage = matchedTerms.length / queryTerms.length;

  // Small bonus for terms appearing more than once, with a cap.
  const repetitionBonus =
    matchedTerms.reduce(
      (sum, term) => sum + Math.min(termCounts.get(term) ?? 0, 3) - 1,
      0
    ) / (queryTerms.length * 2);

  return Math.min(1, coverage + repetitionBonus);
}

export function searchSimilar(
  queryEmbedding: number[],
  topK = DEFAULT_TOP_K,
  queryText = ""
): RetrievedChunk[] {
  const corpus = chunkRepo.listWithItems();

  const scored = corpus
    .map((chunk) => {
      const vectorScore = cosineSimilarity(
        queryEmbedding,
        chunk.embedding
      );
      const lexicalScore = keywordScore(queryText, chunk.text);

      // Mock vectors aren't semantic, so prioritize lexical relevance.
      const score = config.mockAi
        ? 0.2 * Math.max(0, vectorScore) + 0.8 * lexicalScore
        : 0.35 * lexicalScore + 0.65 * Math.max(0, vectorScore);

      return {
        chunkId: chunk.id,
        itemId: chunk.itemId,
        title: chunk.title,
        source: chunk.source,
        type: chunk.type,
        snippet: chunk.text,
        score,
      };
    })
    .filter((hit) => Number.isFinite(hit.score))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
