import "server-only";
import type { Citation, EvidencePack, MarketView, Verdict } from "@/shared/types";
import { parseWithClaude } from "./claude";
import { JudgmentSchema } from "./schemas";
import { RESOLVER_SYSTEM } from "./prompts";

export interface ResolutionJudgment {
  verdict: Verdict;
  confidence: number;
  summary: string;
  citations: Citation[];
  reasoning: string;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const clip = (value: string, max: number) => value.replace(/\s+/gu, " ").trim().slice(0, max);

export async function judgeMarket(market: MarketView, pack: EvidencePack): Promise<ResolutionJudgment> {
  const result = await parseWithClaude({
    schema: JudgmentSchema,
    system: RESOLVER_SYSTEM,
    effort: "high",
    maxTokens: 6000,
    user: `Assess this market using only its stated criteria and the evidence provided.\n<market>\n${JSON.stringify({ promiser: market.promiser, promiseText: market.promiseText, criteria: market.criteria, deadline: new Date(market.deadline * 1000).toISOString() })}\n</market>\n<evidence>\n${JSON.stringify(pack)}\n</evidence>`,
  });
  if (result.refused || !result.value) return { verdict: "unclear", confidence: 0, summary: "The outcome could not be assessed reliably from the available evidence.", citations: [], reasoning: "The model did not return a valid judgment." };

  const judgment = JudgmentSchema.parse(result.value);
  const byUrl = new Map(pack.items.map((item) => [item.url, item]));
  const citations = judgment.citations.flatMap((citation): Citation[] => {
    const evidence = byUrl.get(citation.url);
    if (!evidence || !citation.quote.trim() || !evidence.snippet.toLowerCase().includes(citation.quote.trim().toLowerCase())) return [];
    return [{ url: evidence.url, title: clip(evidence.title, 120), quote: clip(citation.quote, 500) }];
  }).slice(0, 3);

  const confidence = Number.isFinite(judgment.confidence) ? clamp(judgment.confidence, 0, 1) : 0;
  const verdict = citations.length === 0 ? "unclear" : judgment.verdict;
  return {
    verdict,
    confidence: verdict === "unclear" ? Math.min(confidence, 0.69) : confidence,
    summary: clip(judgment.summary, 280),
    citations,
    reasoning: clip(judgment.reasoning, 3000),
  };
}
