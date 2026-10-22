import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../errors.js";
import { logger } from "../logger.js";

export const requestId: RequestHandler = (req, res, next) => {
  const id = req.header("x-request-id") ?? crypto.randomUUID();
  res.setHeader("x-request-id", id);
  req.id = id;
  next();
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    logger.warn({ requestId: req.id, issues: err.issues }, "validation failed");
    res.status(400).json({
      error: "Invalid request",
      details: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    logger.warn({ requestId: req.id, status: err.statusCode, message: err.message }, "app error");
    res.status(err.statusCode).json({ error: err.message, details: err.details ?? null });
    return;
  }

  logger.error({ requestId: req.id, err }, "unhandled error");
  res.status(500).json({ error: "Internal server error" });
};

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}
