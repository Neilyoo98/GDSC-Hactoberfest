import { beforeEach, describe, expect, it, vi } from 'vitest';
import { accepted, modelDraft } from '../../../tests/fixtures/draft';
import { parseWithOpenAI } from './openai';
import { draftMarket } from './drafter';
import { ServiceError } from '../errors';

vi.mock('./openai', () => ({ parseWithOpenAI: vi.fn() }));
beforeEach(() => vi.mocked(parseWithOpenAI).mockReset());
describe('drafter', () => {
  it('accepts an exact quote and attaches the source', async () => {
    vi.mocked(parseWithOpenAI).mockResolvedValue({
      value: modelDraft(),
      refused: false,
    });
    expect(await draftMarket(accepted.source, '2099-01-01')).toEqual(accepted);
  });
  it('passes optional guidance as separate non-evidence context', async () => {
    vi.mocked(parseWithOpenAI).mockResolvedValue({
      value: modelDraft(),
      refused: false,
    });
    await draftMarket(
      accepted.source,
      '2099-01-01',
      undefined,
      'Focus on the transit improvements.',
    );
    expect(parseWithOpenAI).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.stringContaining(
          '<user_guidance>\nFocus on the transit improvements.\n</user_guidance>',
        ),
      }),
    );
  });
  it.each([
    'vague',
    'no_deadline',
    'private_person',
    'death_or_harm',
    'not_a_promise',
    'past_deadline',
  ] as const)('preserves a %s rejection', async (rejectReason) => {
    vi.mocked(parseWithOpenAI).mockResolvedValue({
      value: {
        decision: 'reject',
        rejectReason,
        explanation: 'Not suitable.',
        draft: null,
      },
      refused: false,
    });
    expect(await draftMarket(accepted.source)).toMatchObject({
      decision: 'reject',
      rejectReason,
      draft: null,
    });
  });
  it('rejects invented quotes after one retry', async () => {
    vi.mocked(parseWithOpenAI).mockResolvedValue({
      value: {
        ...modelDraft(),
        draft: {
          ...accepted.draft!,
          promiseText: 'A quote absent from the source.',
        },
      },
      refused: false,
    });
    expect(await draftMarket(accepted.source)).toMatchObject({
      decision: 'reject',
      rejectReason: 'vague',
    });
    expect(parseWithOpenAI).toHaveBeenCalledTimes(2);
  });
  it.each(['2099-02-30', '2098-12-31'])(
    'rejects invalid/past deadline %s',
    async (deadline) => {
      vi.mocked(parseWithOpenAI).mockResolvedValue({
        value: { ...modelDraft(), draft: { ...accepted.draft!, deadline } },
        refused: false,
      });
      expect(await draftMarket(accepted.source, '2099-01-01')).toMatchObject({
        decision: 'reject',
      });
    },
  );
  it('handles model refusal', async () => {
    vi.mocked(parseWithOpenAI).mockResolvedValue({
      value: null,
      refused: true,
    });
    expect(await draftMarket(accepted.source)).toMatchObject({
      decision: 'reject',
      rejectReason: 'death_or_harm',
    });
  });
  it.each([
    'ai_auth',
    'ai_quota',
    'ai_rate_limit',
    'ai_timeout',
    'ai_configuration',
  ])('does not retry %s', async (code) => {
    vi.mocked(parseWithOpenAI).mockRejectedValue(
      new ServiceError('Provider failed.', code),
    );
    await expect(draftMarket(accepted.source)).rejects.toThrow(
      'Provider failed.',
    );
    expect(parseWithOpenAI).toHaveBeenCalledTimes(1);
  });
  it('retries a malformed structured response once', async () => {
    vi.mocked(parseWithOpenAI)
      .mockRejectedValueOnce(
        new ServiceError('Invalid.', 'invalid_ai_response'),
      )
      .mockResolvedValueOnce({ value: modelDraft(), refused: false });
    expect(await draftMarket(accepted.source)).toEqual(accepted);
    expect(parseWithOpenAI).toHaveBeenCalledTimes(2);
  });
});
