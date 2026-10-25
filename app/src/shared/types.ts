// OWNER: P2. Initial contract copied from PLAN.md section 5.1.
export type Side = 'kept' | 'broken';
export type Verdict = Side | 'unclear';
export type Outcome = Side | 'void';
export type MarketStatus =
  'open' | 'proposed' | 'challenged' | 'council' | 'finalized' | 'void';

export interface MarketView {
  id: number; // u64 from config.market_count
  pubkey: string;
  creator: string;
  promiser: string; // "@handle" or organization name (≤ 40 chars)
  promiseText: string; // exact quote (≤ 240 chars)
  criteria: string; // "Kept if … Broken if … Source: …" (≤ 160 chars)
  sourceUrl: string; // ≤ 120 chars
  sourceHash: string; // hex sha256 of the fetched source text
  deadline: number; // unix seconds
  totals: { kept: number; broken: number }; // tUSDC, UI units (not base units)
  status: MarketStatus;
  proposal: null | {
    verdict: Verdict;
    confidence: number;
    summary: string;
    sources: string[];
    proposedAt: number;
    windowEndsAt: number;
  };
  challenger: string | null;
  votes: (Outcome | null)[]; // length 3, index = council seat
  final: Outcome | null;
  forfeitedBonds: number;
}

export interface PositionView {
  market: number;
  owner: string;
  side: Side;
  amount: number;
  claimed: boolean;
}

// ---- Context layer ----
export interface SourceDoc {
  kind: 'x_post' | 'article' | 'text';
  url: string | null;
  author: string | null; // oEmbed author_name / article site
  authorUrl: string | null;
  text: string; // plain text, tags stripped
  publishedAt: string | null; // ISO, if known
  sha256: string; // hex, of `text`
}
export interface EvidenceItem {
  url: string;
  title: string;
  snippet: string;
  publishedAt: string | null;
}
export interface EvidencePack {
  queries: string[];
  items: EvidenceItem[];
  sha256: string;
}

// ---- Intelligence layer ----
export type RejectReason =
  | 'vague'
  | 'no_deadline'
  | 'private_person'
  | 'death_or_harm'
  | 'not_a_promise'
  | 'past_deadline';
export interface MarketDraft {
  promiser: string;
  promiserType: 'person' | 'organization';
  promiseText: string; // exact words from the source
  question: string; // "Will … by …?"
  deadline: string; // ISO date
  criteriaKept: string;
  criteriaBroken: string;
  checkSource: string;
  assumptions: string[]; // e.g. "‘spring’ read as June 20, 2027"
}
export interface DraftResponse {
  decision: 'accept' | 'reject';
  rejectReason: RejectReason | null;
  explanation: string; // shown to the user either way
  draft: MarketDraft | null;
  source: SourceDoc;
}
export interface Citation {
  url: string;
  title: string;
  quote: string;
}
export interface ResolveResponse {
  marketId: number;
  verdict: Verdict;
  confidence: number;
  summary: string;
  citations: Citation[];
  action: 'proposed' | 'sent_to_council' | 'skipped';
  txSig: string | null;
  trace: TraceStep[];
}
export interface TraceStep {
  at: number;
  step: 'read' | 'search' | 'judge' | 'validate' | 'write';
  detail: string;
}

// ---- Orchestration endpoints ----
export interface DraftRequest {
  url?: string;
  text?: string;
} // POST /api/draft
export interface RelayRequest {
  tx: string;
} // base64, user-signed → { signature }
export interface FaucetRequest {
  wallet: string;
} // → { signature, amount } | { error }
