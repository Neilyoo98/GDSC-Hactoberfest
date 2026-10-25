// app/scripts/smoke-devnet.ts    OWNER: P4
// The CP2 gate (H13). Real devnet: faucet → create → 3 stakes → propose → wait → finalize → claim = +40.
// Needs: `npm run dev` running (for /api/faucet and /api/relay), challenge window = 30 s.
// Run:   npm run smoke:devnet   (or: npx tsx scripts/smoke-devnet.ts)
// Proposes with the resolver key directly (no AI) so the verdict, and the +40, are deterministic.
import { loadEnvFile } from "node:process";
import { createHash } from "crypto";

// constants.ts reads env at import time, so load .env.local before importing chain code.
try { loadEnvFile(".env.local"); } catch {}

const APP = process.env.APP_URL ?? "http://localhost:3000";
const t0 = Date.now();
const step = (s: string) => console.log(`\n▶ [${((Date.now() - t0) / 1000).toFixed(0)}s] ${s}`);
const fail = (s: string): never => { console.error(`\n❌ SMOKE FAILED: ${s}`); process.exit(1); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (const v of ["NEXT_PUBLIC_PROGRAM_ID", "NEXT_PUBLIC_TUSDC_MINT", "NEXT_PUBLIC_CONFIG_ADMIN", "NEXT_PUBLIC_FEE_PAYER_PUBKEY", "RESOLVER_SECRET"])
    if (!process.env[v]) fail(`${v} missing from .env.local`);

  const { Keypair, sendAndConfirmTransaction } = await import("@solana/web3.js");
  const { getAccount } = await import("@solana/spl-token");
  const { anchorChain: chain } = await import("../src/chain/anchor");
  const { buildProposeTx } = await import("../src/chain/tx");
  const { connection } = await import("../src/chain/relay");
  const { userAta } = await import("../src/chain/pdas");
  const { keypairWallet } = await import("../src/wallet/burner");
  type PublicKey = import("@solana/web3.js").PublicKey;

  const conn = connection();
  const resolver = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.RESOLVER_SECRET!)));
  const bal = async (pk: PublicKey) => Number((await getAccount(conn, userAta(pk))).amount) / 1e6;
  const expectReject = (p: Promise<unknown>, what: string) =>
    p.then(() => fail(`${what} was accepted`), () => console.log(`  ✓ refused: ${what}`));

  async function faucet(pk: PublicKey) {
    const r = await fetch(`${APP}/api/faucet`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: pk.toBase58() }),
    });
    if (!r.ok) fail(`faucet ${r.status}: ${await r.text()}`);
  }

  const [A, B, C] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
  const [wa, wb, wc] = [A, B, C].map(keypairWallet);

  step("faucet ×3 (wallets hold 0 SOL, so every later step proves gasless)");
  for (const k of [A, B, C]) await faucet(k.publicKey);
  if ((await bal(A.publicKey)) !== 100) fail("faucet did not give 100 tUSDC");

  step("create market, deadline in 30 s");
  const text = "Smoke test: the bridge opens by the deadline.";
  const { id } = await chain.createMarket(wa, {
    promiser: "@SmokeTest", promiserType: "organization", promiseText: text,
    question: "Will the bridge open?", deadline: new Date(Date.now() + 30_000).toISOString(),
    criteriaKept: "open.", criteriaBroken: "not open.", checkSource: "DOT", assumptions: [],
    sourceUrl: "https://x.com/example/status/1",
    sourceHash: createHash("sha256").update(text).digest("hex"),
  });
  console.log(`  market #${id}`);

  step("stakes: A 10 Broken · B 15 Broken · C 75 Kept");
  await chain.stake(wa, id, "broken", 10);
  await chain.stake(wb, id, "broken", 15);
  await chain.stake(wc, id, "kept", 75);
  const m = await chain.getMarket(id);
  if (m?.totals.broken !== 25 || m?.totals.kept !== 75) fail(`totals wrong: ${JSON.stringify(m?.totals)}`);
  console.log("  ✓ totals 75 / 25");

  step("failure paths");
  await expectReject(chain.stake(wa, id, "broken", 1), "second stake from the same wallet");
  await expectReject(chain.stake(wb, id, "kept", 101), "stake of 101");
  await expectReject(chain.finalize(wa, id), "finalize before any proposal");

  step("wait for deadline → propose Broken (resolver key, no AI, so the result is deterministic)");
  while (Date.now() < m!.deadline * 1000 + 3_000) await wait(1_000);
  const tx = await buildProposeTx(resolver.publicKey, id, "broken", 9000,
    "Smoke test proposal.", ["https://example.gov"], new Uint8Array(32));
  await sendAndConfirmTransaction(conn, tx, [resolver], { commitment: "confirmed" });
  const proposed = await chain.getMarket(id);
  if (proposed?.status !== "proposed") fail(`expected proposed, got ${proposed?.status}`);

  step("finalize during the window must fail");
  await expectReject(chain.finalize(wa, id), "finalize inside the window");

  step(`wait for the window (ends ${new Date(proposed!.proposal!.windowEndsAt * 1000).toLocaleTimeString()}) → finalize`);
  while (Date.now() < proposed!.proposal!.windowEndsAt * 1000 + 3_000) await wait(1_000);
  await chain.finalize(wa, id);
  if ((await chain.getMarket(id))?.status !== "finalized") fail("not finalized");

  step("claim: A must get +40, B +60, C refused");
  const a0 = await bal(A.publicKey), b0 = await bal(B.publicKey);
  await chain.claim(wa, id);
  await chain.claim(wb, id);
  const da = (await bal(A.publicKey)) - a0, db = (await bal(B.publicKey)) - b0;
  if (Math.abs(da - 40) > 1e-6) fail(`A got ${da}, expected 40`);
  if (Math.abs(db - 60) > 1e-6) fail(`B got ${db}, expected 60`);
  console.log("  ✓ A +40, B +60");
  await expectReject(chain.claim(wc, id), "loser claim");
  await expectReject(chain.claim(wa, id), "double claim");

  for (const k of [A, B, C])
    if ((await conn.getBalance(k.publicKey)) !== 0) fail("a user wallet holds SOL, so gasless is not proven");

  console.log(`\n✅ SMOKE PASSED in ${((Date.now() - t0) / 1000).toFixed(0)}s: create → stake → propose → finalize → claim = +40, gasless`);
}

main().catch((e) => fail(String(e?.error?.errorCode?.code ?? e?.message ?? e)));
