// app/src/chain/payout.test.ts    OWNER: P4
import { describe, it, expect } from "vitest";
import { payout } from "./payout";
import type { MarketView } from "@/shared/types";

type PayoutMarket = Pick<MarketView, "status" | "final" | "totals" | "forfeitedBonds">;
const m = (overrides: Partial<PayoutMarket> = {}): PayoutMarket => ({
  status: "finalized",
  final: "broken",
  totals: { kept: 75, broken: 25 },
  forfeitedBonds: 0,
  ...overrides,
});

describe("payout", () => {
  it("worked example: 10 × 100 ÷ 25 = 40", () =>
    expect(payout(m(), { side: "broken", amount: 10 })).toBe(40));
  it("second winner: 15 × 100 ÷ 25 = 60", () =>
    expect(payout(m(), { side: "broken", amount: 15 })).toBe(60));
  it("loser gets 0", () =>
    expect(payout(m(), { side: "kept", amount: 75 })).toBe(0));
  it("forfeited bond raises payout: 10 × 110 ÷ 25 = 44", () =>
    expect(payout(m({ forfeitedBonds: 10 }), { side: "broken", amount: 10 })).toBe(44));
  it("void refunds the stake", () =>
    expect(payout(m({ status: "void", final: "void" }), { side: "kept", amount: 5 })).toBe(5));
  it("nobody on the winning side refunds", () =>
    expect(payout(m({ totals: { kept: 5, broken: 0 } }), { side: "kept", amount: 5 })).toBe(5));
  it("floors to base units like the chain: 1 × 100 ÷ 3", () =>
    expect(payout(m({ totals: { kept: 97, broken: 3 } }), { side: "broken", amount: 1 })).toBe(33.333333));
});
