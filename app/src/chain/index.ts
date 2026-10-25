// app/src/chain/index.ts    OWNER: P4
import type { PublicKey, Transaction } from "@solana/web3.js";
import type { MarketView, PositionView, MarketDraft, Side, Outcome } from "@/shared/types";
import { mockChain } from "./mock";
import { anchorChain } from "./anchor";

export { buildProposeTx } from "./tx";

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

// Hooks for P3 (src/chain/hooks.ts): useMarkets(), useMarket(id), usePositions({ owner }), useKeptActions()

export type ChainMode = "mock" | "anchor" | "custodial";
export const CHAIN_MODE = (process.env.NEXT_PUBLIC_CHAIN ?? "mock") as ChainMode;

/** NEXT_PUBLIC_CHAIN = "mock" | "anchor" | "custodial". */
export function getChain(): KeptChain {
  switch (CHAIN_MODE) {
    case "anchor": return anchorChain;
    // TODO(P1): custodial.ts is only filled in if Anchor is called off at a go/no-go.
    case "custodial": throw new Error("custodialChain not implemented (P1 fallback)");
    default: return mockChain;
  }
}
