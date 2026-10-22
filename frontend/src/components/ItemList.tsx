import type { InboxItem } from "../types";

type Props = {
  items: InboxItem[];
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function ItemList({ items }: Props) {
  if (items.length === 0) {
    return <p className="empty">Nothing saved yet. Add a note or URL to start.</p>;
  }

  return (
    <div className="list">
      {items.map((item) => (
        <article className="item" key={item.id}>
          <div className="item-top">
            <h3>{item.title}</h3>
            <span className={`status ${item.status}`}>{item.status}</span>
          </div>
          <div className="meta">
            {item.type} · {formatTime(item.createdAt)}
            {item.status === "ready" ? ` · ${item.chunkCount} chunks` : ""}
          </div>
          {item.preview ? <p className="preview">{item.preview}</p> : null}
          {item.error ? <p className="error">{item.error}</p> : null}
        </article>
      ))}
    </div>
  );
}
