import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";
import type { ChunkRecord, ItemStatus, ItemType, KnowledgeItem } from "./types.js";

const dbPath = path.resolve(process.cwd(), config.databasePath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    source TEXT NOT NULL,
    raw_content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    error TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chunks (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    ordinal INTEGER NOT NULL,
    text TEXT NOT NULL,
    embedding TEXT NOT NULL,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_chunks_item_id ON chunks(item_id);
`);

function rowToItem(row: Record<string, unknown>): KnowledgeItem {
  return {
    id: String(row.id),
    type: row.type as ItemType,
    title: String(row.title),
    source: String(row.source),
    rawContent: String(row.raw_content),
    status: row.status as ItemStatus,
    error: row.error == null ? null : String(row.error),
    createdAt: String(row.created_at),
  };
}

export const itemRepo = {
  insert(item: KnowledgeItem): void {
    db.prepare(
      `INSERT INTO items (id, type, title, source, raw_content, status, error, created_at)
       VALUES (:id, :type, :title, :source, :rawContent, :status, :error, :createdAt)`,
    ).run({
      id: item.id,
      type: item.type,
      title: item.title,
      source: item.source,
      rawContent: item.rawContent,
      status: item.status,
      error: item.error,
      createdAt: item.createdAt,
    });
  },

  updateAfterProcess(
    id: string,
    fields: { title: string; rawContent: string; status: ItemStatus; error: string | null },
  ): void {
    db.prepare(
      `UPDATE items SET title = ?, raw_content = ?, status = ?, error = ? WHERE id = ?`,
    ).run(fields.title, fields.rawContent, fields.status, fields.error, id);
  },

  markFailed(id: string, error: string): void {
    db.prepare(`UPDATE items SET status = 'failed', error = ? WHERE id = ?`).run(error, id);
  },

  get(id: string): KnowledgeItem | undefined {
    const row = db.prepare(`SELECT * FROM items WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToItem(row) : undefined;
  },

  list(): KnowledgeItem[] {
    const rows = db.prepare(`SELECT * FROM items ORDER BY created_at DESC`).all() as Record<
      string,
      unknown
    >[];
    return rows.map(rowToItem);
  },

  countReady(): number {
    const row = db.prepare(`SELECT COUNT(*) as n FROM items WHERE status = 'ready'`).get() as {
      n: number;
    };
    return Number(row.n);
  },
};

export const chunkRepo = {
  replaceForItem(itemId: string, chunks: ChunkRecord[]): void {
    const del = db.prepare(`DELETE FROM chunks WHERE item_id = ?`);
    const ins = db.prepare(
      `INSERT INTO chunks (id, item_id, ordinal, text, embedding)
       VALUES (:id, :itemId, :ordinal, :text, :embeddingJson)`,
    );
    db.exec("BEGIN");
    try {
      del.run(itemId);
      for (const chunk of chunks) {
        ins.run({
          id: chunk.id,
          itemId: chunk.itemId,
          ordinal: chunk.ordinal,
          text: chunk.text,
          embeddingJson: JSON.stringify(chunk.embedding),
        });
      }
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  },

  listWithItems(): Array<ChunkRecord & { title: string; source: string; type: ItemType }> {
    const rows = db
      .prepare(
        `SELECT c.id, c.item_id, c.ordinal, c.text, c.embedding,
                i.title, i.source, i.type
         FROM chunks c
         JOIN items i ON i.id = c.item_id
         WHERE i.status = 'ready'`,
      )
      .all() as Record<string, unknown>[];

    return rows.map((row) => ({
      id: String(row.id),
      itemId: String(row.item_id),
      ordinal: Number(row.ordinal),
      text: String(row.text),
      embedding: JSON.parse(String(row.embedding)) as number[],
      title: String(row.title),
      source: String(row.source),
      type: row.type as ItemType,
    }));
  },

  countForItem(itemId: string): number {
    const row = db.prepare(`SELECT COUNT(*) as n FROM chunks WHERE item_id = ?`).get(itemId) as {
      n: number;
    };
    return Number(row.n);
  },
};
