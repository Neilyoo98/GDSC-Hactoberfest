// app/src/chain/index.ts    OWNER: P4
import type { PublicKey, Transaction } from "@solana/web3.js";
import type { MarketView, PositionView, MarketDraft, Side, Outcome } from "@/shared/types";
import { mockChain } from "./mock";

export interface WalletLike {
  publicKey: PublicKey;
  signTransaction<T extends Transaction>(tx: T): Promise<T>;
}

export interface KeptChain {
  listMarkets(): Promise<MarketView[]>;
  getMarket(id: number): Promise<MarketView | null>;
  listPositions(f?: { owner?: string; market?: number }): Promise<PositionView[]>;
  createMarket(
    w: WalletLike,
    d: MarketDraft & { sourceUrl: string; sourceHash: string },
  ): Promise<{ sig: string; id: number }>;
  stake(w: WalletLike, id: number, side: Side, amount: number): Promise<string>;
  challenge(w: WalletLike, id: number): Promise<string>;
  councilVote(w: WalletLike, id: number, outcome: Outcome): Promise<string>;
  finalize(w: WalletLike, id: number): Promise<string>;
  claim(w: WalletLike, id: number): Promise<string>;
}

// Hooks for P3 (src/chain/hooks.ts, P4-5): useMarkets(), useMarket(id), usePositions({ owner }), useKeptActions()
// buildProposeTx (for P2) is re-exported from here in P4-5.

/** NEXT_PUBLIC_CHAIN = "mock" | "anchor" | "custodial". anchor + custodial are wired in P4-5. */
export function getChain(): KeptChain {
  return mockChain;
}
