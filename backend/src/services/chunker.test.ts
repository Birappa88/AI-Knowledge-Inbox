import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chunkText } from "./chunker.js";

describe("chunkText", () => {
  it("returns empty for blank input", () => {
    assert.deepEqual(chunkText("   "), []);
  });

  it("keeps a short note as a single chunk", () => {
    const chunks = chunkText("Ship notes live in one place.");
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].ordinal, 0);
    assert.match(chunks[0].text, /Ship notes/);
  });

  it("splits a long block into overlapping windows", () => {
    const sentence = "Vector search retrieves nearby chunks for a question. ";
    const long = sentence.repeat(80);
    const chunks = chunkText(long);
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((c) => c.text.length > 0));
    assert.ok(chunks[1].text.includes(chunks[0].text.slice(-20).trim().slice(0, 10)));
  });
});
