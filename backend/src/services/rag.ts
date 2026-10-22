import { itemRepo } from "../db.js";
import { AppError } from "../errors.js";
import { logger } from "../logger.js";
import { embedTexts, generateAnswer } from "./embeddings.js";
import { searchSimilar } from "./vectorStore.js";

export async function answerQuestion(question: string) {
  if (itemRepo.countReady() === 0) {
    throw new AppError(409, "No ready items to search. Ingest a note or URL first.");
  }

  logger.info({ questionLength: question.length }, "query started");
  const [queryEmbedding] = await embedTexts([question]);
  const hits = searchSimilar(queryEmbedding, undefined, question);

  if (hits.length === 0) {
    return {
      answer: "I could not find relevant passages in your inbox for that question.",
      sources: [],
    };
  }

  const contextBlocks = hits.map(
    (hit, index) => `Source ${index + 1} (${hit.title}):\n${hit.snippet}`,
  );
  const answer = await generateAnswer(question, contextBlocks);

  return {
    answer,
    sources: hits.map((hit) => ({
      itemId: hit.itemId,
      title: hit.title,
      source: hit.source,
      type: hit.type,
      snippet: hit.snippet.slice(0, 360),
      score: Number(hit.score.toFixed(3)),
    })),
  };
}
