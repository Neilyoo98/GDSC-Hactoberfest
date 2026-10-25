import { beforeEach, expect, it, vi } from 'vitest';
import { evidence, market } from '../../../tests/fixtures/draft';
import { parseWithOpenAI } from './openai';
import { judgeMarket } from './resolver';
vi.mock('./openai', () => ({ parseWithOpenAI: vi.fn() }));
beforeEach(() => vi.mocked(parseWithOpenAI).mockReset());
const judgment = {
  verdict: 'kept',
  confidence: 0.9,
  summary: 'Buses entered service.',
  reasoning: 'According to the fleet report.',
  citations: [
    {
      url: evidence.items[0].url,
      title: 'Report',
      quote: evidence.items[0].snippet,
    },
  ],
};
it('retains supported citations', async () => {
  vi.mocked(parseWithOpenAI).mockResolvedValue({
    value: judgment,
    refused: false,
  });
  expect(await judgeMarket(market, evidence)).toMatchObject({
    verdict: 'kept',
    confidence: 0.9,
    citations: [{ ...judgment.citations[0], title: 'Fleet report' }],
  });
});
it.each([
  { ...judgment.citations[0], url: 'https://invented.example/report' },
  { ...judgment.citations[0], quote: 'Invented quote' },
])(
  'cannot return a definitive verdict using unsupported citation %j',
  async (citation) => {
    vi.mocked(parseWithOpenAI).mockResolvedValue({
      value: { ...judgment, citations: [citation] },
      refused: false,
    });
    expect(await judgeMarket(market, evidence)).toMatchObject({
      verdict: 'unclear',
      confidence: 0.69,
      citations: [],
    });
  },
);
it('retains low confidence so the 0.7 proposal gate can route to council', async () => {
  vi.mocked(parseWithOpenAI).mockResolvedValue({
    value: { ...judgment, confidence: 0.65 },
    refused: false,
  });
  expect(await judgeMarket(market, evidence)).toMatchObject({
    confidence: 0.65,
  });
});
it('handles refusal as unclear', async () => {
  vi.mocked(parseWithOpenAI).mockResolvedValue({ value: null, refused: true });
  expect(await judgeMarket(market, evidence)).toMatchObject({
    verdict: 'unclear',
    confidence: 0,
    citations: [],
  });
});
