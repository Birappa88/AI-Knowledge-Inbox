import { FormEvent, useState } from "react";
import { queryInbox } from "../api";
import type { QueryResult } from "../types";

export function QueryPanel() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await queryInbox(question);
      setResult(next);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2>Ask the inbox</h2>
      <form onSubmit={onSubmit}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="What did I save about embeddings?"
          required
        />
        {error ? <p className="error">{error}</p> : null}
        <button className="primary" type="submit" disabled={busy || question.trim().length < 3}>
          {busy ? "Searching..." : "Ask"}
        </button>
      </form>

      {result ? (
        <div>
          <p className="answer">{result.answer}</p>
          {result.sources.length > 0 ? (
            <div className="sources">
              {result.sources.map((source, index) => (
                <article className="source" key={`${source.itemId}-${index}`}>
                  <header>
                    <strong>
                      [{index + 1}] {source.title}
                    </strong>
                    <span className="meta">score {source.score}</span>
                  </header>
                  <p className="preview">{source.snippet}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="empty">Answers include the retrieved snippets used as context.</p>
      )}
    </section>
  );
}
