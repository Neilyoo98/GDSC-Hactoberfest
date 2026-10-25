// app/src/chain/payout.ts    OWNER: P4
import type { MarketView, PositionView } from "@/shared/types";

const U = 1_000_000n;
const toBase = (n: number) => BigInt(Math.round(n * 1_000_000));

/** Returns UI units (tUSDC). Mirrors the on-chain claim math (u128, floor). */
export function payout(
  m: Pick<MarketView, "status" | "final" | "totals" | "forfeitedBonds">,
  p: Pick<PositionView, "side" | "amount">,
): number {
  const amount = toBase(p.amount);
  const winners =
    m.final === "kept" ? toBase(m.totals.kept) : m.final === "broken" ? toBase(m.totals.broken) : 0n;
  if (m.status === "void" || winners === 0n) return Number(amount) / 1e6; // refund
  if (p.side !== m.final) return 0;
  const pool = toBase(m.totals.kept) + toBase(m.totals.broken) + toBase(m.forfeitedBonds);
  const out = (amount * pool) / winners; // BigInt division floors, like u128
  return Number(out / U) + Number(out % U) / 1e6;
}
