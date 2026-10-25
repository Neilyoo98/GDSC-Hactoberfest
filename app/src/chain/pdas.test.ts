// app/src/chain/pdas.test.ts    OWNER: P4
// H6: every PDA in pdas.ts must equal the one built from the IDL's own seed list.
import { describe, it, expect, beforeAll } from "vitest";
import { Keypair, PublicKey } from "@solana/web3.js";
import rawIdl from "../shared/idl/kept.json";

const idl = rawIdl as any;
const PROGRAM = new PublicKey(idl.address);
const admin = Keypair.generate().publicKey;
const user = Keypair.generate().publicKey;
const ID = 7;

const u64le = (n: number) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};

/** Derive an account's PDA from the IDL seeds, resolving account/arg paths from ctx. */
function fromIdl(ix: string, account: string, ctx: Record<string, Buffer>): PublicKey {
  const acc = idl.instructions.find((i: any) => i.name === ix).accounts.find((a: any) => a.name === account);
  const seeds = acc.pda.seeds.map((s: any) => {
    if (s.kind === "const") return Buffer.from(s.value);
    if (!(s.path in ctx)) throw new Error(`no ctx for seed ${s.path}`);
    return ctx[s.path];
  });
  return PublicKey.findProgramAddressSync(seeds, PROGRAM)[0];
}

let p: typeof import("./pdas");
beforeAll(async () => {
  // constants.ts reads env at import time, so set it before importing pdas.
  process.env.NEXT_PUBLIC_PROGRAM_ID = idl.address;
  process.env.NEXT_PUBLIC_CONFIG_ADMIN = admin.toBase58();
  process.env.NEXT_PUBLIC_TUSDC_MINT = Keypair.generate().publicKey.toBase58();
  p = await import("./pdas");
});

describe("PDAs match the IDL", () => {
  it("program id comes from the IDL address", () => {
    expect(p.programId().equals(PROGRAM)).toBe(true);
  });

  it("config = [config, admin]", () => {
    expect(p.configPda().equals(fromIdl("initialize_config", "config", { admin: admin.toBuffer() }))).toBe(true);
  });

  it("market = [market, config, id u64 LE]", () => {
    const config = p.configPda();
    const ctx = { config: config.toBuffer(), "config.admin": admin.toBuffer(), "config.market_count": u64le(ID) };
    expect(p.marketPda(ID).equals(fromIdl("create_market", "market", ctx))).toBe(true);
  });

  it("vault and position match place_stake", () => {
    const config = p.configPda();
    const market = p.marketPda(ID);
    const ctx = {
      config: config.toBuffer(), "config.admin": admin.toBuffer(), "market.id": u64le(ID),
      market: market.toBuffer(), user: user.toBuffer(),
    };
    expect(market.equals(fromIdl("place_stake", "market", ctx))).toBe(true);
    expect(p.vaultPda(market).equals(fromIdl("place_stake", "vault", ctx))).toBe(true);
    expect(p.positionPda(market, user).equals(fromIdl("place_stake", "position", ctx))).toBe(true);
  });

  it("different market ids give different addresses", () => {
    expect(p.marketPda(1).equals(p.marketPda(2))).toBe(false);
  });
});
