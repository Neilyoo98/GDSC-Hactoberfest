import "server-only";
import type { SourceDoc } from "@/shared/types";
import { normalizeText, sha256Hex } from "./hash";

const MAX_TEXT_CHARS = 20_000;

export function sourceFromText(input: string): SourceDoc {
  const text = normalizeText(input).slice(0, MAX_TEXT_CHARS);
  if (!text) throw new Error("Source text cannot be empty.");
  return { kind: "text", url: null, author: null, authorUrl: null, text, publishedAt: null, sha256: sha256Hex(text) };
}
