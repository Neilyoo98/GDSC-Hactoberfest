import { z } from 'zod';

export {
  RejectReasonSchema,
  MarketDraftSchema,
  DraftSchema,
  type DraftOutput,
} from '@/shared/draftSchemas';

export const CitationSchema = z
  .object({
    url: z.string().url(),
    title: z.string().min(1).max(500),
    quote: z.string().min(1).max(2000),
  })
  .strict();
export const JudgmentSchema = z
  .object({
    verdict: z.enum(['kept', 'broken', 'unclear']),
    confidence: z.number(),
    summary: z.string().min(1).max(1000),
    citations: z.array(CitationSchema).max(8),
    reasoning: z.string().min(1).max(4000),
  })
  .strict();

export type Judgment = z.infer<typeof JudgmentSchema>;
