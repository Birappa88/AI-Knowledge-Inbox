import { Router } from "express";
import { z } from "zod";
import { config } from "./config.js";
import { chunkRepo, itemRepo } from "./db.js";
import { enqueueItem, scheduleIngest } from "./services/ingest.js";
import { answerQuestion } from "./services/rag.js";

export const router = Router();

const ingestSchema = z
  .object({
    type: z.enum(["note", "url"]),
    content: z.string().trim().min(1).max(20_000),
  })
  .superRefine((value, ctx) => {
    if (value.type === "url") {
      if (value.content.length > 2048) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "URL is too long", path: ["content"] });
      }
      try {
        new URL(value.content);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "content must be a valid URL", path: ["content"] });
      }
    }
  });

const querySchema = z.object({
  question: z.string().trim().min(3).max(2000),
});

router.get("/health", (_req, res) => {
  res.json({ ok: true, mockAi: config.mockAi });
});

router.post("/ingest", (req, res, next) => {
  try {
    const body = ingestSchema.parse(req.body);
    const item = enqueueItem(body.type, body.content);
    scheduleIngest(item.id);
    res.status(202).json({
      id: item.id,
      type: item.type,
      title: item.title,
      source: item.source,
      status: item.status,
      createdAt: item.createdAt,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/items", (_req, res) => {
  const items = itemRepo.list().map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    source: item.source,
    status: item.status,
    error: item.error,
    createdAt: item.createdAt,
    chunkCount: item.status === "ready" ? chunkRepo.countForItem(item.id) : 0,
    preview: item.rawContent.slice(0, 180),
  }));
  res.json({ items, mockAi: config.mockAi });
});

router.post("/query", async (req, res, next) => {
  try {
    const body = querySchema.parse(req.body);
    const result = await answerQuestion(body.question);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
