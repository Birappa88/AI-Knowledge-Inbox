# AI Knowledge Inbox

A small production-style web app for the Turium AI full-stack take-home: save notes or URLs, then ask questions over that content with a simple RAG pipeline.

The emphasis is a readable system, not a demo of infrastructure. One process, SQLite on disk, an in-process ingest queue, and either OpenAI or a local mock so the app can always run.

## Run locally

Requires Node 22.13+ (uses the built-in `node:sqlite` module).

```bash
cp .env.example .env
# Optional: put an OpenAI key in .env
npm install
npm run dev
```

- UI: http://localhost:5173
- API: http://localhost:3001

Without `OPENAI_API_KEY`, the server uses **mock embeddings** (deterministic hashed vectors) and an extractive answer. Retrieval still works; answers will not be model-written. Set a key for real embeddings + `gpt-4o-mini`.

The inbox lives in `backend/data/inbox.db`. Delete that file to reset.

```bash
npm test          # chunker unit tests
npm run build     # typecheck/build both packages
```

## What it does

1. **Ingest a note** — stored as-is.
2. **Ingest a URL** — server fetches the page, strips chrome, keeps readable text.
3. **Index** — chunk, embed, persist vectors next to the item.
4. **Ask** — embed the question, retrieve top chunks by cosine similarity, send those snippets + the question to the LLM, return the answer with source snippets.

Ingest is asynchronous: `POST /ingest` returns `202` with `status: "processing"`. A single-flight in-process queue fetches/chunks/embeds so URL work does not block the HTTP thread. The UI polls `GET /items` until status is `ready` or `failed`.

## API

| Method | Path | Body | Success |
| --- | --- | --- | --- |
| POST | `/ingest` | `{ "type": "note" \| "url", "content": "..." }` | `202` item stub |
| GET | `/items` | — | `{ items, mockAi }` |
| POST | `/query` | `{ "question": "..." }` | `{ answer, sources[] }` |
| GET | `/health` | — | `{ ok, mockAi }` |

Validation is Zod-backed. Typical failures:

- `400` bad payload / invalid URL
- `409` query before any item is ready
- `422` page had no usable text
- `502` upstream fetch failed or timed out

Errors look like `{ "error": "...", "details": ... }` and include `x-request-id`.

## Design

```
React (Vite)  →  Express
                    ├─ ingest queue (async)
                    ├─ URL fetch + HTML extract
                    ├─ paragraph-first chunker
                    ├─ OpenAI or mock embeddings
                    ├─ SQLite items + chunks
                    └─ retrieve → LLM → cited answer
```

Layers are split on purpose: routes validate and shape HTTP, services own ingest/RAG, `db.ts` owns SQL. There is no shared “god file.”

### Chunking

Paragraph-first packing to ~800 characters, then ~120 characters of overlap.

- Paragraphs stay together when they fit, which keeps a thought in one vector.
- Long blocks (legal pages, walls of text) are window-split on sentence/space boundaries.
- Overlap reduces the “answer split across two chunks” miss.
- Cap of 40 chunks per item keeps a single noisy URL from dominating the corpus.

This is not semantic splitting. It is cheap, deterministic, and good enough for short notes and article-length pages.

### Vector store

Embeddings are JSON arrays in SQLite (`node:sqlite`, no native addon), searched with brute-force cosine similarity in process.

Why this instead of Pinecone / sqlite-vec / faiss:

- Zero extra services and no `node-gyp` for a reviewer.
- The data model is inspectable with any SQLite browser.
- For hundreds of chunks, linear scan is simpler than an ANN index and easier to debug.

Tradeoff: query cost is O(chunks × dimensions). JSON storage is larger than a typed blob. There is no metadata filter or hybrid BM25.

### Async ingest

URL fetch and embedding batches can take seconds. Returning after the full pipeline would make the UI feel stuck and would couple request timeouts to OpenAI latency.

A tiny in-memory queue is enough for a single-user app. It does **not** survive process restart (an item can stay `processing`). A production worker would persist jobs (SQLite table or Redis) and retry with backoff.

### SSRF

URL ingest resolves the host and rejects localhost / private ranges, caps body size at 1MB, and times out at 10s. That is table-stakes for “server fetches a user URL,” not a full SSRF program.

## What breaks at scale

| Area | This build | Where it falls over |
| --- | --- | --- |
| Search | Load all embeddings, cosine in JS | Thousands+ chunks: memory + latency |
| Ingest | One queue, one process | Concurrent users, crash mid-job |
| Fetch | Live HTML extract | JS-rendered sites, PDFs, auth walls |
| Models | One embedding space, one chat model | Re-embedding on model change |
| Multi-user | None | Isolation, quotas, prompt injection across tenants |
| Eval | Manual | Silent retrieval regressions |

## What I would change in production

1. Persist jobs; make ingest idempotent; show per-item progress.
2. Store embeddings as `BLOB` / `FLOAT32` and add an ANN index (sqlite-vec, pgvector, or a hosted store) once the corpus leaves “personal inbox” size.
3. Hybrid retrieval (BM25 + vectors) and a reranker before the LLM.
4. Structured citations tied to chunk ids, not just titles.
5. Eval set: questions with expected item ids, measured hit-rate@k.
6. Auth, per-user namespaces, rate limits, and stronger URL allowlists.
7. Re-chunk / re-embed as a background migration when the embedding model changes.

## Tradeoffs I accepted

- **Node + Express + React**, matching the brief. FastAPI would be equivalent; I kept one language across UI and API.
- **OpenAI `text-embedding-3-small` + `gpt-4o-mini`** for cost and quality. Local models are better for air-gapped review; mock mode covers “clone and run.”
- **No auth, no Docker, no queue product.** Those would hide the RAG design under ceremony.
- **Clarity over visual polish.** The UI is two panels: inbox and ask.

## Project layout

```
backend/src/
  index.ts                 HTTP server
  routes.ts                /ingest /items /query
  db.ts                    SQLite schema + repos
  services/chunker.ts
  services/embeddings.ts   OpenAI + mock
  services/fetchPage.ts
  services/ingest.ts       queue + pipeline
  services/vectorStore.ts
  services/rag.ts
frontend/src/
  App.tsx
  components/              ingest, list, query
```
