import { z } from "zod";

export const RejectReasonSchema = z.enum(["vague", "no_deadline", "private_person", "death_or_harm", "not_a_promise", "past_deadline"]);

export const MarketDraftSchema = z.object({
  promiser: z.string().min(1).max(120),
  promiserType: z.enum(["person", "organization"]),
  promiseText: z.string().min(1).max(1000),
  question: z.string().min(1).max(500),
  deadline: z.string().min(1).max(100),
  criteriaKept: z.string().min(1).max(500),
  criteriaBroken: z.string().min(1).max(500),
  checkSource: z.string().min(1).max(300),
  assumptions: z.array(z.string().max(300)).max(8),
}).strict();

export const DraftSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("accept"), rejectReason: z.null(), explanation: z.string().min(1).max(400), draft: MarketDraftSchema }).strict(),
  z.object({ decision: z.literal("reject"), rejectReason: RejectReasonSchema, explanation: z.string().min(1).max(400), draft: z.null() }).strict(),
]);

export const CitationSchema = z.object({ url: z.string().url(), title: z.string().min(1).max(500), quote: z.string().min(1).max(2000) }).strict();
export const JudgmentSchema = z.object({
  verdict: z.enum(["kept", "broken", "unclear"]),
  confidence: z.number(),
  summary: z.string().min(1).max(1000),
  citations: z.array(CitationSchema).max(8),
  reasoning: z.string().min(1).max(4000),
}).strict();

export type DraftOutput = z.infer<typeof DraftSchema>;
export type Judgment = z.infer<typeof JudgmentSchema>;
