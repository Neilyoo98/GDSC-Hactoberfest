import { z } from 'zod';

export const HttpUrlSchema = z
  .string()
  .trim()
  .url()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value);
      const lastPathSegment = url.pathname.split('/').at(-1) ?? '';
      const encodedSpaces = url.pathname.match(/%20/giu)?.length ?? 0;
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        lastPathSegment.length <= 512 &&
        encodedSpaces <= 8
      );
    } catch {
      return false;
    }
  }, 'Use the original HTTP(S) page URL only; remove any text appended to it.');

export const DraftRequestSchema = z
  .object({
    url: HttpUrlSchema.optional(),
    text: z.string().trim().min(1).max(20_000).optional(),
    guidance: z.string().trim().max(2_000).optional(),
  })
  .strict()
  .refine((body) => Boolean(body.url || body.text), {
    message: 'Provide a URL, source text, or both.',
  });

export const RejectReasonSchema = z.enum([
  'vague',
  'no_deadline',
  'private_person',
  'death_or_harm',
  'not_a_promise',
  'past_deadline',
]);

export const MarketDraftSchema = z
  .object({
    promiser: z.string().min(1).max(40),
    promiserType: z.enum(['person', 'organization']),
    promiseText: z.string().min(1).max(240),
    question: z.string().min(1).max(500),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    criteriaKept: z.string().min(1).max(160),
    criteriaBroken: z.string().min(1).max(160),
    checkSource: z.string().min(1).max(300),
    assumptions: z.array(z.string().max(300)).max(8),
  })
  .strict();

export const DraftSchema = z.discriminatedUnion('decision', [
  z
    .object({
      decision: z.literal('accept'),
      rejectReason: z.null(),
      explanation: z.string().min(1).max(400),
      draft: MarketDraftSchema,
    })
    .strict(),
  z
    .object({
      decision: z.literal('reject'),
      rejectReason: RejectReasonSchema,
      explanation: z.string().min(1).max(400),
      draft: z.null(),
    })
    .strict(),
]);

export const SourceDocSchema = z.object({
  kind: z.enum(['x_post', 'article', 'text']),
  url: HttpUrlSchema.nullable(),
  author: z.string().nullable(),
  authorUrl: HttpUrlSchema.nullable(),
  text: z.string().min(1).max(20_000),
  publishedAt: z.string().nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/u),
});

export const DraftResponseSchema = z.intersection(
  DraftSchema,
  z.object({ source: SourceDocSchema }),
);

export const ResolveResponseSchema = z.object({
  marketId: z.number().int().nonnegative(),
  verdict: z.enum(['kept', 'broken', 'unclear']),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(280),
  citations: z.array(z.object({
    url: HttpUrlSchema,
    title: z.string().min(1).max(120),
    quote: z.string().min(1).max(500),
  }).strict()).max(3),
  action: z.enum(['proposed', 'sent_to_council', 'skipped']),
  txSig: z.string().nullable(),
  trace: z.array(z.object({
    at: z.number().int(),
    step: z.enum(['read', 'search', 'judge', 'validate', 'write']),
    detail: z.string().max(500),
  }).strict()),
}).strict();

export type DraftOutput = z.infer<typeof DraftSchema>;
