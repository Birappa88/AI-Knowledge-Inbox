import OpenAI from "openai";
import { createHash } from "node:crypto";
import { config } from "../config.js";
import { logger } from "../logger.js";
import { log } from "node:console";

const MOCK_DIMS = 64;
const EMBED_BATCH = 16;

function mockVector(text: string): number[] {
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  const vec = new Array<number>(MOCK_DIMS).fill(0);
  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    for (let i = 0; i < MOCK_DIMS; i++) {
      vec[i] += (digest[i % digest.length] - 128) / 128;
    }
  }
  const norm = Math.sqrt(vec.reduce((sum, n) => sum + n * n, 0)) || 1;
  return vec.map((n) => n / norm);
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (config.mockAi) {
    logger.warn({ count: texts.length }, "embedding with local mock vectors");
    return texts.map(mockVector);
  }
  
  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const batch = texts.slice(i, i + EMBED_BATCH);
    const response = await client.embeddings.create({
      model: config.openaiEmbeddingModel,
      input: batch,
    });
    const ordered = [...response.data].sort((x, y) => x.index - y.index);
    for (const item of ordered) {
      vectors.push(item.embedding);
    }
  }

  return vectors;
}

export async function generateAnswer(question: string, contextBlocks: string[]): Promise<string> {
  if (config.mockAi) {
    const joined = contextBlocks.join("\n\n");
    return (
      `(Mock AI — set OPENAI_API_KEY for generated answers.)\n\n` +
      `Based on the retrieved notes:\n\n${joined.slice(0, 1400)}`
    );
  }

  const client = new OpenAI({ apiKey: config.openaiApiKey });
  const context = contextBlocks
    .map((block, i) => `[${i + 1}]\n${block}`)
    .join("\n\n");

  const response = await client.chat.completions.create({
    model: config.openaiChatModel,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content:
          "You answer questions using only the numbered source snippets. " +
          "Cite sources inline like [1] or [2]. If the sources do not contain the answer, say so. " +
          "Keep the answer concise.",
      },
      {
        role: "user",
        content: `Sources:\n${context}\n\nQuestion: ${question}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) {
    throw new Error("Model returned an empty answer");
  }
  return text;
}
