import { randomUUID } from "node:crypto";
import { chunkRepo, itemRepo } from "../db.js";
import { AppError } from "../errors.js";
import { logger } from "../logger.js";
import type { ItemType, KnowledgeItem } from "../types.js";
import { chunkText } from "./chunker.js";
import { embedTexts } from "./embeddings.js";
import { fetchPageContent } from "./fetchPage.js";

function noteTitle(text: string): string {
  const firstLine = text.split("\n").find((line) => line.trim()) ?? "Untitled note";
  return firstLine.trim().slice(0, 80);
}

export function enqueueItem(type: ItemType, content: string): KnowledgeItem {
  const now = new Date().toISOString();
  const item: KnowledgeItem = {
    id: randomUUID(),
    type,
    title: type === "note" ? noteTitle(content) : content,
    source: type === "url" ? content.trim() : "note",
    rawContent: type === "note" ? content.trim() : "",
    status: "processing",
    error: null,
    createdAt: now,
  };
  itemRepo.insert(item);
  return item;
}

export async function processItem(id: string): Promise<void> {
  const item = itemRepo.get(id);
  if (!item) return;

  logger.info({ itemId: id, type: item.type }, "ingest started");

  try {
    let title = item.title;
    let rawContent = item.rawContent;

    if (item.type === "url") {
      const page = await fetchPageContent(item.source);
      title = page.title;
      rawContent = page.text;
    }

    const chunks = chunkText(rawContent);
    if (chunks.length === 0) {
      throw new AppError(422, "No usable text to index");
    }

    const embeddings = await embedTexts(chunks.map((chunk) => chunk.text));
    chunkRepo.replaceForItem(
      id,
      chunks.map((chunk, index) => ({
        id: randomUUID(),
        itemId: id,
        ordinal: chunk.ordinal,
        text: chunk.text,
        embedding: embeddings[index],
      })),
    );

    itemRepo.updateAfterProcess(id, {
      title,
      rawContent,
      status: "ready",
      error: null,
    });
    logger.info({ itemId: id, chunks: chunks.length }, "ingest ready");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingest failed";
    itemRepo.markFailed(id, message);
    logger.error({ itemId: id, err: error }, "ingest failed");
  }
}

const queue: string[] = [];
let draining = false;

export function scheduleIngest(id: string): void {
  queue.push(id);
  void drain();
}

async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    await processItem(id);
  }
  draining = false;
}
