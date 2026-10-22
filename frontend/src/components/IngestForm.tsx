import { FormEvent, useState } from "react";
import { ingest } from "../api";
import type { ItemType } from "../types";

type Props = {
  onCreated: () => void;
};

export function IngestForm({ onCreated }: Props) {
  const [type, setType] = useState<ItemType>("note");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await ingest(type, content);
      setContent("");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ingest failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="tabs">
        <button type="button" className={type === "note" ? "active" : ""} onClick={() => setType("note")}>
          Note
        </button>
        <button type="button" className={type === "url" ? "active" : ""} onClick={() => setType("url")}>
          URL
        </button>
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={type === "note" ? "Paste a short note..." : "https://example.com/article"}
        required
      />
      <p className="hint">
        {type === "note"
          ? "Plain text is stored, chunked, and embedded."
          : "The server fetches the page, extracts readable text, then indexes it."}
      </p>
      {error ? <p className="error">{error}</p> : null}
      <button className="primary" type="submit" disabled={busy || content.trim().length === 0}>
        {busy ? "Saving..." : "Save to inbox"}
      </button>
    </form>
  );
}
