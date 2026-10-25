// app/src/chain/contract.test.ts    OWNER: P4
// The KeptChain contract. Runs in mock mode inside `npm run check` (offline).
// Every implementation (mock, anchor, custodial) must behave this way.
import { describe, it, expect } from "vitest";
import { mockChain } from "./mock";
import { FIXTURES } from "./fixtures";
import { payout } from "./payout";
import { makeTestWallet } from "../wallet/burner";
import type { MarketView } from "@/shared/types";
import { LIMITS, MIN_STAKE, MAX_STAKE } from "../shared/constants";

const chain = mockChain;
const STATUSES = ["open", "proposed", "challenged", "council", "finalized", "void"];

function checkShape(m: MarketView) {
  expect(STATUSES).toContain(m.status);
  expect(m.votes).toHaveLength(3);
  expect(m.totals.kept).toBeGreaterThanOrEqual(0);
  expect(m.totals.broken).toBeGreaterThanOrEqual(0);
  expect(m.promiser.length).toBeLessThanOrEqual(LIMITS.promiser);
  expect(m.promiseText.length).toBeLessThanOrEqual(LIMITS.promiseText);
  expect(m.criteria.length).toBeLessThanOrEqual(LIMITS.criteria);
  expect(m.sourceHash).toMatch(/^[0-9a-f]{64}$/);
  if (["proposed", "challenged"].includes(m.status)) expect(m.proposal).not.toBeNull();
  if (m.status === "challenged") expect(m.challenger).not.toBeNull();
  if (m.status === "finalized") expect(m.final).not.toBeNull();
}

const openMarket = async () => (await chain.listMarkets()).find((m) => m.status === "open")!;

describe("KeptChain contract (mock)", () => {
  it("every market has a valid shape", async () => {
    const markets = await chain.listMarkets();
    expect(markets.length).toBeGreaterThan(0);
    markets.forEach(checkShape);
  });

  it("fixtures cover every status so P3 can render every state", async () => {
    const seen = new Set((await chain.listMarkets()).map((m) => m.status));
    for (const s of STATUSES) expect(seen).toContain(s);
  });

  it("getMarket returns null for an unknown id", async () => {
    expect(await chain.getMarket(9999)).toBeNull();
  });

  it("reads are copies: mutating a result does not change chain state", async () => {
    const m = await openMarket();
    m.totals.kept = -1;
    expect((await chain.getMarket(m.id))!.totals.kept).toBeGreaterThanOrEqual(0);
  });

  it("stake moves the totals by exactly the amount and records a position", async () => {
    const w = makeTestWallet();
    const open = await openMarket();
    await chain.stake(w, open.id, "broken", 10);
    const after = await chain.getMarket(open.id);
    expect(after!.totals.broken).toBe(open.totals.broken + 10);
    const pos = await chain.listPositions({ owner: w.publicKey.toBase58() });
    expect(pos).toEqual([{ market: open.id, owner: w.publicKey.toBase58(), side: "broken", amount: 10, claimed: false }]);
  });

  it("rejects stakes outside 1–100 and a second stake", async () => {
    const w = makeTestWallet();
    const open = await openMarket();
    await expect(chain.stake(w, open.id, "kept", MIN_STAKE - 1)).rejects.toThrow();
    await expect(chain.stake(w, open.id, "kept", MAX_STAKE + 1)).rejects.toThrow();
    await chain.stake(w, open.id, "kept", 5);
    await expect(chain.stake(w, open.id, "kept", 5)).rejects.toThrow();
  });

  it("rejects stakes on a market that is not open", async () => {
    const closed = (await chain.listMarkets()).find((m) => m.status === "finalized")!;
    await expect(chain.stake(makeTestWallet(), closed.id, "kept", 5)).rejects.toThrow();
  });

  it("createMarket returns a new id that reads back as open with zero totals", async () => {
    const { id, sig } = await chain.createMarket(makeTestWallet(), {
      promiser: "@Test", promiserType: "person", promiseText: "I will ship it.",
      question: "Shipped?", deadline: new Date(Date.now() + 86_400_000).toISOString(),
      criteriaKept: "shipped.", criteriaBroken: "not shipped.", checkSource: "GitHub", assumptions: [],
      sourceUrl: "https://x.com/t/status/1", sourceHash: "ab".repeat(32),
    });
    expect(sig).toBeTruthy();
    const m = await chain.getMarket(id);
    checkShape(m!);
    expect(m!.status).toBe("open");
    expect(m!.totals).toEqual({ kept: 0, broken: 0 });
  });

  it("createMarket rejects a past deadline", async () => {
    await expect(chain.createMarket(makeTestWallet(), {
      promiser: "@Test", promiserType: "person", promiseText: "x", question: "x",
      deadline: new Date(Date.now() - 60_000).toISOString(),
      criteriaKept: "x", criteriaBroken: "x", checkSource: "x", assumptions: [],
      sourceUrl: "https://x.com/t/status/1", sourceHash: "ab".repeat(32),
    })).rejects.toThrow();
  });

  it("challenge moves proposed → challenged, and only once", async () => {
    const proposed = (await chain.listMarkets()).find((m) => m.status === "proposed")!;
    const w = makeTestWallet();
    await chain.challenge(w, proposed.id);
    const m = await chain.getMarket(proposed.id);
    expect(m!.status).toBe("challenged");
    expect(m!.challenger).toBe(w.publicKey.toBase58());
    await expect(chain.challenge(makeTestWallet(), proposed.id)).rejects.toThrow();
  });

  it("two matching council votes settle the market", async () => {
    const council = (await chain.listMarkets()).find((m) => m.status === "council")!;
    await chain.councilVote(makeTestWallet(), council.id, "broken");
    expect((await chain.getMarket(council.id))!.status).toBe("council");
    await chain.councilVote(makeTestWallet(), council.id, "broken");
    const m = await chain.getMarket(council.id);
    expect(m!.status).toBe("finalized");
    expect(m!.final).toBe("broken");
  });

  it("finalize is rejected unless the market is proposed", async () => {
    const open = await openMarket();
    await expect(chain.finalize(makeTestWallet(), open.id)).rejects.toThrow();
  });

  it("the worked-example fixture pays 10 × 100 ÷ 25 = 40", () => {
    const m = FIXTURES.find((x) => x.status === "finalized")!;
    expect(m.totals).toEqual({ kept: 75, broken: 25 });
    expect(payout(m, { side: "broken", amount: 10 })).toBe(40);
  });

  it("claim is rejected without a position, and on a market that isn't settled", async () => {
    await expect(chain.claim(makeTestWallet(), 4)).rejects.toThrow();
    const w = makeTestWallet();
    const open = await openMarket();
    await chain.stake(w, open.id, "kept", 5);
    await expect(chain.claim(w, open.id)).rejects.toThrow();
  });
});
