import { useCallback, useEffect, useState } from "react";
import { listItems } from "./api";
import { IngestForm } from "./components/IngestForm";
import { ItemList } from "./components/ItemList";
import { QueryPanel } from "./components/QueryPanel";
import type { InboxItem } from "./types";

export function App() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [mockAi, setMockAi] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await listItems();
      setItems(data.items);
      setMockAi(data.mockAi);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load items");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const pending = items.some((item) => item.status === "processing");
    if (!pending) return;
    const timer = window.setInterval(() => {
      void refresh();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [items, refresh]);

  return (
    <div className="app">
      <header className="masthead">
        <div>
          <p className="eyebrow">Turium take-home</p>
          <h1>AI Knowledge Inbox</h1>
          <p className="lede">
            Save notes or URLs, then ask questions over the retrieved chunks. Ingest is asynchronous;
            items appear as processing until embeddings are stored.
          </p>
        </div>
        <div className="badge">{mockAi ? "MOCK_AI on" : "OpenAI embeddings + chat"}</div>
      </header>

      <div className="layout">
        <section className="panel">
          <h2>Inbox</h2>
          <IngestForm onCreated={() => void refresh()} />
          {loadError ? <p className="error">{loadError}</p> : null}
          <ItemList items={items} />
        </section>
        <QueryPanel />
      </div>
    </div>
  );
}
