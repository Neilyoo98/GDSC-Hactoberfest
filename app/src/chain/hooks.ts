// app/src/chain/hooks.ts    OWNER: P4
"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import type { MarketView, PositionView, Side, Outcome, MarketDraft } from "../shared/types";
import { CHAIN_MODE, getChain, type WalletLike } from "./index";
import { explorerTx } from "./relay";

const chain = getChain();
// PLAN: 3 s on the market page, 10 s elsewhere. Any confirmed tx also refetches right away.
const POLL_MARKET_MS = 3_000;
const POLL_LIST_MS = 10_000;

const listeners = new Set<() => void>();
const refreshAll = () => listeners.forEach((f) => f());

function usePolled<T>(load: () => Promise<T>, every: number) {
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<Error | null>(null);
  const reload = useCallback(() => {
    load().then(
      (value) => { setData(value); setError(null); },
      (cause: unknown) => setError(cause instanceof Error ? cause : new Error('Could not load chain data.')),
    );
  }, [load]);
  useEffect(() => {
    reload();
    listeners.add(reload);
    const t = setInterval(reload, every);
    return () => { listeners.delete(reload); clearInterval(t); };
  }, [reload, every]);
  return { data, error, loading: data === undefined && !error, reload };
}

export function useMarkets() {
  const load = useCallback(() => chain.listMarkets(), []);
  return usePolled<MarketView[]>(load, POLL_LIST_MS);
}
export function useMarket(id: number) {
  const load = useCallback(() => chain.getMarket(id), [id]);
  return usePolled<MarketView | null>(load, POLL_MARKET_MS);
}
export function usePositions(f?: { owner?: string; market?: number }) {
  const owner = f?.owner;
  const market = f?.market;
  const load = useCallback(() => chain.listPositions({ owner, market }), [owner, market]);
  return usePolled<PositionView[]>(load, market !== undefined ? POLL_MARKET_MS : POLL_LIST_MS);
}

/** Toasts: Waiting for wallet → Confirmed ↗ Explorer, or the error. */
async function run<T>(label: string, fn: () => Promise<T>, sigOf: (r: T) => string): Promise<T> {
  const id = toast.loading(`${label}: waiting for wallet…`);
  try {
    const r = await fn();
    const sig = sigOf(r);
    toast.success(`${label}: confirmed`, {
      id,
      action: sig.startsWith("mock") ? undefined : { label: "Explorer ↗", onClick: () => window.open(explorerTx(sig), "_blank") },
    });
    refreshAll();
    return r;
  } catch (cause: unknown) {
    toast.error(`${label} failed`, { id, description: friendly(cause) });
    throw cause;
  }
}

/** Program error names come from the IDL (program/README.md). */
function friendly(cause: unknown): string {
  const root = typeof cause === 'object' && cause !== null ? cause as Record<string, unknown> : {};
  const nested = typeof root.error === 'object' && root.error !== null ? root.error as Record<string, unknown> : {};
  const errorCode = typeof nested.errorCode === 'object' && nested.errorCode !== null ? nested.errorCode as Record<string, unknown> : {};
  const msg = String(errorCode.code ?? root.message ?? cause);
  if (/User rejected/i.test(msg)) return "You cancelled in your wallet.";
  if (/StakeOutOfRange/.test(msg)) return "Stake must be between 1 and 100 tUSDC.";
  if (/already in use|AlreadyStaked/.test(msg)) return "You already have a stake on this market.";
  if (/PastDeadline|NotOpen/.test(msg)) return "This market is closed for staking.";
  if (/DeadlineInPast|DeadlinePassed/.test(msg)) return "Pick a deadline in the future.";
  if (/TextTooLong/.test(msg)) return "The promise text is too long for one transaction.";
  if (/WindowClosed/.test(msg)) return "The challenge window has closed.";
  if (/WindowOpen/.test(msg)) return "Wait until the challenge window ends.";
  if (/NotCouncil/.test(msg)) return "This wallet isn't on the council.";
  if (/AlreadyVoted/.test(msg)) return "You already voted on this market.";
  if (/NotInReview|NotInCouncil/.test(msg)) return "This market isn't waiting for a council vote.";
  if (/NotFinal|NotFinalized/.test(msg)) return "This market hasn't been settled yet.";
  if (/AlreadyClaimed/.test(msg)) return "Already claimed.";
  if (/NotWinner|NoPosition/.test(msg)) return "Nothing to claim for this wallet.";
  if (/insufficient/i.test(msg)) return "Not enough tUSDC. Use the faucet first.";
  return msg.slice(0, 160);
}

async function faucetRequest(w: WalletLike): Promise<string> {
  // Mock mode works with the backend off.
  if (CHAIN_MODE === "mock") return "mock-faucet-" + w.publicKey.toBase58().slice(0, 8);
  const r = await fetch("/api/faucet", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet: w.publicKey.toBase58() }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(j.error === "already_claimed" ? "Faucet already used for this wallet." : j.error ?? `faucet ${r.status}`);
  return j.signature as string;
}

export function useKeptActions() {
  const { publicKey, signTransaction } = useWallet();
  const wallet = useMemo<WalletLike | null>(
    () => (publicKey && signTransaction ? { publicKey, signTransaction: signTransaction as WalletLike["signTransaction"] } : null),
    [publicKey, signTransaction],
  );
  const need = () => {
    if (!wallet) { toast.error("Connect a wallet first"); throw new Error("wallet not connected"); }
    return wallet;
  };
  const sig = (s: string) => s;

  return {
    wallet,
    createMarket: (d: MarketDraft & { sourceUrl: string; sourceHash: string }) =>
      run("Create market", () => chain.createMarket(need(), d), (r) => r.sig),
    stake: (id: number, side: Side, amount: number) => run("Stake", () => chain.stake(need(), id, side, amount), sig),
    challenge: (id: number) => run("Challenge", () => chain.challenge(need(), id), sig),
    councilVote: (id: number, o: Outcome) => run("Council vote", () => chain.councilVote(need(), id, o), sig),
    finalize: (id: number) => run("Finalize", () => chain.finalize(need(), id), sig),
    claim: (id: number) => run("Claim", () => chain.claim(need(), id), sig),
    faucet: () => run("Faucet", () => faucetRequest(need()), sig),
  };
}
