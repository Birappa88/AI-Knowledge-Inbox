import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });
dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 3001),
  logLevel: process.env.LOG_LEVEL ?? "info",
  databasePath: process.env.DATABASE_PATH ?? "./data/inbox.db",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
  openaiChatModel: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
  mockAi:
    process.env.MOCK_AI === "true" ||
    !process.env.OPENAI_API_KEY ||
    process.env.OPENAI_API_KEY.trim() === "",
};
