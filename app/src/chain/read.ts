// app/src/chain/read.ts    OWNER: P4
// Decoding boundary: base units → UI units, u8 codes → strings, default pubkey → null.
// Pure functions only, so read.test.ts runs without the IDL or RPC.
import { PublicKey } from "@solana/web3.js";
import type { MarketStatus, MarketView, Outcome, PositionView, Side, Verdict } from "../shared/types";
import { SIDE, TUSDC_BASE } from "../shared/constants";

const DEFAULT_KEY = PublicKey.default.toBase58();

type Num = number | bigint | { toString(): string }; // BN, bigint or number
export const ui = (n: Num) => Number(n.toString()) / TUSDC_BASE;
export const toBase = (uiAmount: number) => BigInt(Math.round(uiAmount * TUSDC_BASE));
const int = (n: Num) => Number(n.toString());
const key = (k: PublicKey | string) => (typeof k === "string" ? k : k.toBase58());
const hex = (b: number[] | Uint8Array) => Buffer.from(b).toString("hex");

// 0 = none, 1 = kept, 2 = broken, 3 = void/unclear (constants.ts SIDE)
export const SIDE_CODE: Record<Side, number> = { kept: SIDE.kept, broken: SIDE.broken };
export const OUTCOME_CODE: Record<Outcome, number> = { kept: SIDE.kept, broken: SIDE.broken, void: SIDE.void };
export const VERDICT_CODE: Record<Verdict, number> = { kept: SIDE.kept, broken: SIDE.broken, unclear: SIDE.void };
const side = (c: number): Side => (c === SIDE.kept ? "kept" : "broken");
const outcome = (c: number): Outcome | null =>
  c === SIDE.kept ? "kept" : c === SIDE.broken ? "broken" : c === SIDE.void ? "void" : null;
const verdict = (c: number): Verdict => (c === SIDE.kept ? "kept" : c === SIDE.broken ? "broken" : "unclear");

/** Anchor decodes `Status::Open` as `{ open: {} }`; lowercase in case the IDL casing leaks through. */
const status = (s: Record<string, unknown>) => Object.keys(s)[0].toLowerCase() as MarketStatus;

/** Raw Market account as Anchor's TS client returns it (camelCased fields). Extra IDL fields are ignored. */
export interface RawMarket {
  id: Num; creator: PublicKey | string;
  promiser: string; promiseText: string; criteria: string; sourceUrl: string; sourceHash: number[] | Uint8Array;
  deadline: Num; totalKept: Num; totalBroken: Num;
  status: Record<string, unknown>;
  proposed: number; confidenceBps: number; summary: string; sources: string[];
  proposedAt: Num; challenger: PublicKey | string; votes: number[];
  finalOutcome: number; forfeitedBonds: Num;
}
export interface RawPosition { market?: PublicKey | string; owner: PublicKey | string; side: number; amount: Num; claimed: boolean; }

export function decodeMarket(pubkey: PublicKey | string, r: RawMarket, challengeWindow: number): MarketView {
  const proposedAt = int(r.proposedAt);
  return {
    id: int(r.id),
    pubkey: key(pubkey),
    creator: key(r.creator),
    promiser: r.promiser,
    promiseText: r.promiseText,
    criteria: r.criteria,
    sourceUrl: r.sourceUrl,
    sourceHash: hex(r.sourceHash),
    deadline: int(r.deadline),
    totals: { kept: ui(r.totalKept), broken: ui(r.totalBroken) },
    status: status(r.status),
    proposal: r.proposed === 0 ? null : {
      verdict: verdict(r.proposed),
      confidence: r.confidenceBps / 10_000,
      summary: r.summary,
      sources: r.sources,
      proposedAt,
      windowEndsAt: proposedAt + challengeWindow,
    },
    challenger: key(r.challenger) === DEFAULT_KEY ? null : key(r.challenger),
    votes: Array.from(r.votes, outcome),
    final: outcome(r.finalOutcome),
    forfeitedBonds: ui(r.forfeitedBonds),
  };
}

export function decodePosition(marketId: number, r: RawPosition): PositionView {
  return { market: marketId, owner: key(r.owner), side: side(r.side), amount: ui(r.amount), claimed: r.claimed };
}
