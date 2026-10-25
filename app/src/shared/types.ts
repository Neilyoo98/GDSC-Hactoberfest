export type Side = "kept" | "broken";
export type Verdict = Side | "unclear";
export type Outcome = Side | "void";
export type MarketStatus = "open" | "proposed" | "challenged" | "council" | "finalized" | "void";

export interface MarketView {
  id: number;
  pubkey: string;
  creator: string;
  promiser: string;
  promiseText: string;
  criteria: string;
  sourceUrl: string;
  sourceHash: string;
  deadline: number;
  totals: { kept: number; broken: number };
  status: MarketStatus;
  proposal: null | { verdict: Verdict; confidence: number; summary: string; sources: string[]; proposedAt: number; windowEndsAt: number };
  challenger: string | null;
  votes: (Outcome | null)[];
  final: Outcome | null;
  forfeitedBonds: number;
}

export interface PositionView { market: number; owner: string; side: Side; amount: number; claimed: boolean; }

export interface SourceDoc {
  kind: "x_post" | "article" | "text";
  url: string | null;
  author: string | null;
  authorUrl: string | null;
  text: string;
  publishedAt: string | null;
  sha256: string;
}
export interface EvidenceItem { url: string; title: string; snippet: string; publishedAt: string | null; }
export interface EvidencePack { queries: string[]; items: EvidenceItem[]; sha256: string; }

export type RejectReason = "vague" | "no_deadline" | "private_person" | "death_or_harm" | "not_a_promise" | "past_deadline";
export interface MarketDraft {
  promiser: string;
  promiserType: "person" | "organization";
  promiseText: string;
  question: string;
  deadline: string;
  criteriaKept: string;
  criteriaBroken: string;
  checkSource: string;
  assumptions: string[];
}
export interface DraftResponse { decision: "accept" | "reject"; rejectReason: RejectReason | null; explanation: string; draft: MarketDraft | null; source: SourceDoc; }
export interface Citation { url: string; title: string; quote: string; }
export interface ResolveResponse {
  marketId: number; verdict: Verdict; confidence: number; summary: string; citations: Citation[];
  action: "proposed" | "sent_to_council" | "skipped"; txSig: string | null; trace: TraceStep[];
}
export interface TraceStep { at: number; step: "read" | "search" | "judge" | "validate" | "write"; detail: string; }
export interface DraftRequest { url?: string; text?: string; }
export interface RelayRequest { tx: string; }
export interface FaucetRequest { wallet: string; }
