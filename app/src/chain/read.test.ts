// app/src/chain/read.test.ts    OWNER: P4
import { describe, it, expect } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import { decodeMarket, decodePosition, type RawMarket } from "./read";

// BigInt() calls, not 0n literals: tsconfig targets ES2017.
const big = (n: number) => BigInt(n);
const creator = Keypair.generate().publicKey;
const raw = (o: Partial<RawMarket> = {}): RawMarket => ({
  id: big(7), creator, promiser: "@Gov", promiseText: "x", criteria: "y", sourceUrl: "https://x.com/a/status/1",
  sourceHash: new Uint8Array(32).fill(0xab), deadline: big(1_800_000_000),
  totalKept: big(75_000_000), totalBroken: big(25_000_000), status: { open: {} },
  proposed: 0, confidenceBps: 0, summary: "", sources: [], proposedAt: big(0),
  challenger: PublicKey.default, votes: [0, 0, 0], finalOutcome: 0, forfeitedBonds: big(0),
  ...o,
});

describe("decodeMarket", () => {
  it("converts base units to UI units", () => {
    const m = decodeMarket(creator, raw({ forfeitedBonds: big(10_000_000) }), 30);
    expect(m.totals).toEqual({ kept: 75, broken: 25 });
    expect(m.forfeitedBonds).toBe(10);
    expect(m.id).toBe(7);
  });

  it("maps enums and u8 codes to strings", () => {
    const m = decodeMarket(creator, raw({
      status: { challenged: {} }, proposed: 2, confidenceBps: 8600, proposedAt: big(1000),
      votes: [1, 0, 3], finalOutcome: 0,
    }), 30);
    expect(m.status).toBe("challenged");
    expect(m.proposal).toMatchObject({ verdict: "broken", confidence: 0.86, proposedAt: 1000, windowEndsAt: 1030 });
    expect(m.votes).toEqual(["kept", null, "void"]);
    expect(m.final).toBeNull();
  });

  it("reads a capitalized enum key (IDL casing) as lowercase", () => {
    expect(decodeMarket(creator, raw({ status: { Finalized: {} } }), 30).status).toBe("finalized");
  });

  it("proposed = 3 reads as unclear, final = 3 as void", () => {
    const m = decodeMarket(creator, raw({ proposed: 3, finalOutcome: 3, status: { void: {} } }), 30);
    expect(m.proposal!.verdict).toBe("unclear");
    expect(m.final).toBe("void");
  });

  it("default pubkey → null challenger; real key → base58", () => {
    expect(decodeMarket(creator, raw(), 30).challenger).toBeNull();
    const c = Keypair.generate().publicKey;
    expect(decodeMarket(creator, raw({ challenger: c }), 30).challenger).toBe(c.toBase58());
  });

  it("no proposal → null; source hash → 64 hex chars", () => {
    const m = decodeMarket(creator, raw(), 30);
    expect(m.proposal).toBeNull();
    expect(m.sourceHash).toBe("ab".repeat(32));
  });
});

describe("decodePosition", () => {
  it("decodes side and amount", () => {
    const owner = Keypair.generate().publicKey;
    expect(decodePosition(3, { owner, side: 2, amount: big(10_000_000), claimed: false }))
      .toEqual({ market: 3, owner: owner.toBase58(), side: "broken", amount: 10, claimed: false });
  });
});
