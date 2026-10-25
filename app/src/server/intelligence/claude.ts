import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

let client: Anthropic | undefined;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not configured.");
  client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function parseWithClaude<T>(args: {
  schema: z.ZodType<T>;
  system: string;
  user: string;
  effort: "low" | "high";
  maxTokens?: number;
}): Promise<{ value: T | null; refused: boolean }> {
  const response = await getClient().messages.parse({
    model: "claude-opus-5-5",
    max_tokens: args.maxTokens ?? 4000,
    output_config: { effort: args.effort, format: zodOutputFormat(args.schema) },
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });
  if (response.stop_reason === "refusal") return { value: null, refused: true };
  return { value: response.parsed_output ?? null, refused: false };
}
