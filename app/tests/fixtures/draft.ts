import type {
  DraftResponse,
  MarketView,
  EvidencePack,
} from '../../src/shared/types';

// Fictional data used only for deterministic tests, never presented as a real promise.
export const sourceText =
  'Example Transit says: We will introduce ten electric buses by December 31, 2099.';
export const accepted: DraftResponse = {
  decision: 'accept',
  rejectReason: null,
  explanation: 'A specific public commitment with a deadline.',
  source: {
    kind: 'text',
    url: null,
    author: null,
    authorUrl: null,
    text: sourceText,
    publishedAt: null,
    sha256: 'a'.repeat(64),
  },
  draft: {
    promiser: 'Example Transit',
    promiserType: 'organization',
    promiseText: 'We will introduce ten electric buses by December 31, 2099.',
    question:
      'Will Example Transit introduce ten electric buses by December 31, 2099?',
    deadline: '2099-12-31',
    criteriaKept:
      'Official fleet report lists ten electric buses in service by the deadline.',
    criteriaBroken:
      'Official fleet report lists fewer than ten electric buses in service by the deadline.',
    checkSource: 'Example Transit official fleet report',
    assumptions: [],
  },
};
export const rejected: DraftResponse = {
  decision: 'reject',
  rejectReason: 'no_deadline',
  explanation: 'This statement does not include a deadline.',
  draft: null,
  source: { ...accepted.source, text: 'We will improve transit.' },
};
export const market: MarketView = {
  id: 1,
  pubkey: '',
  creator: '',
  promiser: 'Example Transit',
  promiseText: sourceText,
  criteria: 'Ten buses in service according to the official fleet report.',
  sourceUrl: 'https://example.com/promise',
  sourceHash: 'a'.repeat(64),
  deadline: 4090867200,
  totals: { kept: 75, broken: 25 },
  status: 'open',
  proposal: null,
  challenger: null,
  votes: [null, null, null],
  final: null,
  forfeitedBonds: 0,
};
export const evidence: EvidencePack = {
  queries: ['Example Transit buses'],
  sha256: 'b'.repeat(64),
  items: [
    {
      url: 'https://example.com/report',
      title: 'Fleet report',
      snippet: 'Ten electric buses entered service on December 1, 2099.',
      publishedAt: '2099-12-01',
    },
  ],
};
export function modelDraft(response = accepted) {
  const { source: _source, ...value } = response;
  void _source;
  return value;
}
