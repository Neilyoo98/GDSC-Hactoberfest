import 'server-only';
import { z } from 'zod';
import { ServiceError, isTimeout } from '../errors';

type JsonSchema = Record<string, unknown>;
type OpenAIContent = { type?: string; text?: string; refusal?: string };
type OpenAIResponse = {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  output?: Array<{ type?: string; content?: OpenAIContent[] }>;
  error?: { code?: string };
};

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim())
    throw new ServiceError(
      'OpenAI is not configured on the server. Set OPENAI_API_KEY and restart the app.',
      'ai_not_configured',
      503,
    );
  return key;
}

function normalizeSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSchema);
  if (typeof value !== 'object' || value === null) return value;

  const normalized: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === '$schema' || key === 'format') continue;
    if (key === 'oneOf') {
      normalized.anyOf = normalizeSchema(item);
      continue;
    }
    if (key === 'const') {
      normalized.enum = [item];
      continue;
    }
    normalized[key] = normalizeSchema(item);
  }
  return normalized;
}

function toStructuredOutputSchema(schema: z.ZodType): JsonSchema {
  // Responses structured outputs need an object at the root. The envelope also
  // allows our drafter's accept/reject union to stay nested under anyOf.
  return {
    type: 'object',
    properties: { result: normalizeSchema(z.toJSONSchema(schema)) },
    required: ['result'],
    additionalProperties: false,
  };
}

export async function parseWithOpenAI<T>(args: {
  schema: z.ZodType<T>;
  schemaName: string;
  system: string;
  user: string;
  effort: 'low' | 'high';
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<{ value: T | null; refused: boolean }> {
  const key = getApiKey();
  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.any([
        AbortSignal.timeout(60_000),
        ...(args.signal ? [args.signal] : []),
      ]),
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-6-astra',
        instructions: args.system,
        input: args.user,
        reasoning: { effort: args.effort },
        max_output_tokens: args.maxTokens ?? 4000,
        text: {
          format: {
            type: 'json_schema',
            name: args.schemaName,
            strict: true,
            schema: toStructuredOutputSchema(args.schema),
          },
        },
      }),
    });
  } catch (error) {
    if (isTimeout(error))
      throw new ServiceError(
        'AI drafting took too long. Please try again.',
        'ai_timeout',
        504,
      );
    throw new ServiceError(
      'Could not connect to OpenAI. Please try again.',
      'ai_unavailable',
      502,
    );
  }

  const payload = (await response
    .json()
    .catch(() => null)) as OpenAIResponse | null;
  if (!response.ok) {
    if (response.status === 401)
      throw new ServiceError(
        "OpenAI rejected the server API key. Check the key's validity and restart the app.",
        'ai_auth',
        503,
      );
    if (response.status === 429) {
      const quota = payload?.error?.code === 'insufficient_quota';
      throw new ServiceError(
        quota
          ? 'The OpenAI API account has no available quota. Check API billing and project limits.'
          : 'OpenAI is rate limiting requests. Wait a moment and try again.',
        quota ? 'ai_quota' : 'ai_rate_limit',
        429,
      );
    }
    if ([400, 403, 404].includes(response.status))
      throw new ServiceError(
        "OpenAI could not use the configured model or request settings. Check OPENAI_MODEL and this project's model access.",
        'ai_configuration',
        503,
      );
    throw new ServiceError(
      'OpenAI is temporarily unavailable. Please try again.',
      'ai_unavailable',
    );
  }
  if (!payload)
    throw new ServiceError(
      'OpenAI returned an unreadable response. Please try again.',
      'invalid_ai_response',
    );

  const content = payload.output?.flatMap((item) => item.content ?? []) ?? [];
  if (
    content.some(
      (item) => item.type === 'refusal' || typeof item.refusal === 'string',
    )
  ) {
    return { value: null, refused: true };
  }
  if (payload.status !== 'completed') {
    throw new ServiceError(
      'OpenAI did not finish the draft. Please try again with a shorter source excerpt.',
      'ai_incomplete',
    );
  }

  const text = content.find((item) => item.type === 'output_text')?.text;
  if (!text)
    throw new ServiceError(
      'OpenAI returned no draft. Please try again.',
      'invalid_ai_response',
    );
  try {
    const envelope: unknown = JSON.parse(text);
    if (
      typeof envelope !== 'object' ||
      envelope === null ||
      !('result' in envelope)
    ) {
      throw new Error('Missing result.');
    }
    const value: unknown = envelope.result;
    return { value: args.schema.parse(value), refused: false };
  } catch {
    throw new ServiceError(
      'OpenAI returned an invalid draft. Please try again.',
      'invalid_ai_response',
    );
  }
}
