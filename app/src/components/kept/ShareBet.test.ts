import { describe, expect, it } from 'vitest';
import { shareText } from './ShareBet';

const market = { promiser: '@ExampleGov', promiseText: 'We will finish repaving Route 1 by June 1, 2027.', deadline: Date.UTC(2027, 4, 30) / 1000 };

describe('shareText', () => {
  it('states the side, amount, promiser, quote and deadline', () => {
    const t = shareText(market, 'broken', 10);
    expect(t).toContain('✕ Broken with 10 tUSDC');
    expect(t).toContain('@ExampleGov');
    expect(t).toContain('“We will finish repaving Route 1 by June 1, 2027.”');
    expect(t).toContain('Due May');
  });
  it('fits in one post with the link (X counts links as 23 chars)', () => {
    const long = { ...market, promiseText: 'x'.repeat(240) };
    expect(shareText(long, 'kept', 100).length + 1 + 23).toBeLessThanOrEqual(280);
    expect(shareText(long, 'kept', 100)).toContain('…');
  });
});
