import "server-only";
import { createHash } from "node:crypto";

export function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(normalizeText(text), "utf8").digest("hex");
}
