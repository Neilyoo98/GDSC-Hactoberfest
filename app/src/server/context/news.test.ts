import { describe, expect, it } from 'vitest';
import { cleanTitle, dedupe, looksLikeDatedPromise, type NewsPromise } from './news';

const item = (title: string, extra: Partial<NewsPromise> = {}): NewsPromise => ({
  url: `https://news.example/${encodeURIComponent(title)}`,
  title,
  source: 'news.example',
  snippet: '',
  publishedAt: '2026-10-24T10:00:00Z',
  ...extra,
});

describe('looksLikeDatedPromise', () => {
  it('keeps a public commitment with a date', () => {
    expect(looksLikeDatedPromise(item('Mayor pledges to open the new library by March 2027'))).toBe(true);
  });
  it('drops charity pledge drives, undated items and social posts', () => {
    expect(looksLikeDatedPromise(item('2027 pledge campaign goal reaches $825,000'))).toBe(false);
    expect(looksLikeDatedPromise(item('Mayor pledges to open library by 2027', { publishedAt: null }))).toBe(false);
    expect(looksLikeDatedPromise(item('CEO promises launch by 2027', { source: 'm.facebook.com' }))).toBe(false);
  });
  it('drops promises with no deadline', () => {
    expect(looksLikeDatedPromise(item('Senator promises to fight for families'))).toBe(false);
  });
  it('drops deadlines that are not commitments', () => {
    expect(looksLikeDatedPromise(item('NFL Trade Deadline 2026: five teams that should buy'))).toBe(false);
    expect(looksLikeDatedPromise(item('Gallery sets submission deadline for 2026 exhibit'))).toBe(false);
  });
  it('keeps official targets', () => {
    expect(looksLikeDatedPromise(item('Iceland sets 2030 targets for reading and maths'))).toBe(true);
  });
});

describe('cleanTitle', () => {
  it('strips site suffixes and outlet prefixes', () => {
    expect(cleanTitle('PM fulfils promise to expedite projects | The Star')).toBe('PM fulfils promise to expedite projects');
    expect(cleanTitle('BERNAMA - PM fulfils promise to expedite projects')).toBe('PM fulfils promise to expedite projects');
  });
});

describe('dedupe', () => {
  it('collapses the same story reworded by two outlets', () => {
    const out = dedupe([
      item('2027: Tinubu promises sustained prosperity, development'),
      item('2027: Tinubu promises prosperity, development', { url: 'https://other.example/x' }),
      item('Governor vows to finish the bridge by 2027'),
    ]);
    expect(out.map((i) => i.title)).toEqual([
      '2027: Tinubu promises sustained prosperity, development',
      'Governor vows to finish the bridge by 2027',
    ]);
  });
});
