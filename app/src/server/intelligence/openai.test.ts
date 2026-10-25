import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accepted, modelDraft } from '../../../tests/fixtures/draft';
import { parseWithOpenAI } from './openai';
import { DraftSchema } from './schemas';

const run = () =>
  parseWithOpenAI({
    schema: DraftSchema,
    schemaName: 'draft',
    system: 'Draft.',
    user: 'Source.',
    effort: 'low',
  });
const complete = (text: string) => ({
  status: 'completed',
  output: [{ type: 'message', content: [{ type: 'output_text', text }] }],
});
beforeEach(() => vi.stubEnv('OPENAI_API_KEY', 'test-only-not-a-real-key'));
describe('OpenAI Responses adapter', () => {
  it('sends a strict object envelope and validates the result', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json(complete(JSON.stringify({ result: modelDraft() }))),
    );
    expect(await run()).toEqual({
      value: modelDraft(accepted),
      refused: false,
    });
    const init = vi.mocked(fetch).mock.calls[0][1]!;
    const body = JSON.parse(init.body as string);
    expect(body.text.format).toMatchObject({
      type: 'json_schema',
      strict: true,
      schema: {
        type: 'object',
        required: ['result'],
        additionalProperties: false,
      },
    });
    expect(body.text.format.schema.properties.result.anyOf).toHaveLength(2);
    expect(JSON.stringify(body.text.format.schema)).not.toContain('"oneOf"');
  });
  it('does not call upstream without configuration', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    await expect(run()).rejects.toMatchObject({
      code: 'ai_not_configured',
      status: 503,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    [401, 'invalid_api_key', 'ai_auth'],
    [429, 'insufficient_quota', 'ai_quota'],
    [429, 'rate_limit_exceeded', 'ai_rate_limit'],
    [404, 'model_not_found', 'ai_configuration'],
    [500, 'server_error', 'ai_unavailable'],
  ] as const)(
    'maps HTTP %s / %s without leaking upstream details',
    async (status, code, expected) => {
      vi.mocked(fetch).mockResolvedValue(
        Response.json(
          { error: { code, message: 'sensitive upstream detail' } },
          { status },
        ),
      );
      await expect(run()).rejects.toMatchObject({ code: expected });
      await expect(run()).rejects.not.toThrow('sensitive upstream detail');
    },
  );
  it.each(['not json', '{}', '{"result":{"decision":"accept"}}'])(
    'rejects invalid output %s',
    async (text) => {
      vi.mocked(fetch).mockResolvedValue(Response.json(complete(text)));
      await expect(run()).rejects.toMatchObject({
        code: 'invalid_ai_response',
      });
    },
  );
  it('handles refusal separately from schema validation', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        status: 'completed',
        output: [{ content: [{ type: 'refusal', refusal: 'Refused.' }] }],
      }),
    );
    expect(await run()).toEqual({ value: null, refused: true });
  });
  it('reports incomplete output', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        status: 'incomplete',
        incomplete_details: { reason: 'max_output_tokens' },
      }),
    );
    await expect(run()).rejects.toMatchObject({ code: 'ai_incomplete' });
  });
  it('reports upstream timeouts', async () => {
    vi.mocked(fetch).mockRejectedValue(
      new DOMException('Timed out.', 'TimeoutError'),
    );
    await expect(run()).rejects.toMatchObject({
      code: 'ai_timeout',
      status: 504,
    });
  });
});
