export type Chunk = {
  ordinal: number;
  text: string;
};

const TARGET_CHARS = 800;
const OVERLAP_CHARS = 120;
const MAX_CHUNKS = 40;

function normalize(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function splitLongBlock(block: string): string[] {
  if (block.length <= TARGET_CHARS) return [block];

  const parts: string[] = [];
  let start = 0;
  while (start < block.length) {
    let end = Math.min(start + TARGET_CHARS, block.length);
    if (end < block.length) {
      const slice = block.slice(start, end);
      const lastBreak = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"), slice.lastIndexOf(" "));
      if (lastBreak > TARGET_CHARS * 0.5) {
        end = start + lastBreak + 1;
      }
    }
    const piece = block.slice(start, end).trim();
    if (piece) parts.push(piece);
    if (end >= block.length) break;
    start = Math.max(0, end - OVERLAP_CHARS);
  }
  return parts;
}

/**
 * Paragraph-first packing with overlap.
 * Prefer keeping a paragraph intact; only window-split when a block is larger than TARGET_CHARS.
 */
export function chunkText(raw: string): Chunk[] {
  const text = normalize(raw);
  if (!text) return [];

  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const packed: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) packed.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > TARGET_CHARS) {
      flush();
      packed.push(...splitLongBlock(paragraph));
      continue;
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > TARGET_CHARS) {
      flush();
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  flush();

  const withOverlap: string[] = [];
  for (let i = 0; i < packed.length; i++) {
    const prevTail =
      i > 0 && packed[i - 1].length > OVERLAP_CHARS
        ? packed[i - 1].slice(-OVERLAP_CHARS).trim()
        : i > 0
          ? packed[i - 1]
          : "";
    const merged = prevTail ? `${prevTail}\n${packed[i]}` : packed[i];
    withOverlap.push(merged);
  }

  return withOverlap.slice(0, MAX_CHUNKS).map((chunk, ordinal) => ({ ordinal, text: chunk }));
}
