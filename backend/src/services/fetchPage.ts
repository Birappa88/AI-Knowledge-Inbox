import { load } from "cheerio";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "../errors.js";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_000_000;

function isPrivateAddress(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "0.0.0.0") return true;
  if (ip.startsWith("10.")) return true;
  if (ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  const match = ip.match(/^172\.(\d+)\./);
  if (match) {
    const second = Number(match[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe80")) return true;
  return false;
}

async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new AppError(400, "Invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError(400, "Only http and https URLs are allowed");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new AppError(400, "Private URLs are not allowed");
  }
  const ip = isIP(url.hostname) ? url.hostname : (await lookup(url.hostname)).address;
  if (isPrivateAddress(ip)) {
    throw new AppError(400, "Private URLs are not allowed");
  }
  return url;
}

function extractReadableText(html: string, fallbackTitle: string): { title: string; text: string } {
  const $ = load(html);
  $("script, style, noscript, iframe, svg, nav, footer, form").remove();
  const title = $("title").first().text().trim() || $("h1").first().text().trim() || fallbackTitle;
  const main = $("article, main, [role=main]").first();
  const body = (main.length ? main : $("body")).text();
  const text = body.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ").trim();
  return { title, text };
}

export async function fetchPageContent(rawUrl: string): Promise<{ title: string; text: string; source: string }> {
  const url = await assertPublicHttpUrl(rawUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "AI-Knowledge-Inbox/1.0" },
    });
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError" ? "Timed out fetching URL" : "Failed to fetch URL";
    throw new AppError(502, message);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new AppError(502, `Upstream returned HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain") && contentType !== "") {
    throw new AppError(400, `Unsupported content type: ${contentType}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new AppError(502, "Empty response body");
  }

  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_BYTES) {
      await reader.cancel();
      throw new AppError(400, "Page is larger than 1MB");
    }
    chunks.push(value);
  }

  const html = new TextDecoder("utf-8").decode(Buffer.concat(chunks));
  if (contentType.includes("text/plain")) {
    return { title: url.hostname, text: html.trim(), source: url.toString() };
  }

  const extracted = extractReadableText(html, url.hostname);
  if (extracted.text.length < 40) {
    throw new AppError(422, "Could not extract enough readable text from the page");
  }
  return { title: extracted.title.slice(0, 140), text: extracted.text, source: url.toString() };
}
