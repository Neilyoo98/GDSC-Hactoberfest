// app/scripts/demo-expired.ts    OWNER: P1
// Pitch prep: a real market whose deadline has already passed, so "Run resolution" works live on stage.
// The program refuses past deadlines, so this creates one that ends in DEADLINE_S seconds, stakes from
// three gasless wallets (10 + 15 Broken, 75 Kept), waits out the deadline and prints the market URL.
// The promise already came true, so the AI resolver finds evidence and proposes Kept.
// Needs: `npm run dev` running (for /api/faucet and /api/relay).
// Run:   npx tsx scripts/demo-expired.ts            (then click "Run resolution" on the printed page)
//        npx tsx scripts/demo-expired.ts --propose  (no AI: proposes Kept with the resolver key)
import { loadEnvFile } from "node:process";
import { createHash } from "crypto";

// constants.ts reads env at import time, so load .env.local before importing chain code.
try { loadEnvFile(".env.local"); } catch {}

const APP = process.env.APP_URL ?? "http://localhost:3000";
const DEADLINE_S = Number(process.env.DEADLINE_S ?? 45);
const fail = (s: string): never => { console.error(`\n❌ ${s}`); process.exit(1); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  for (const v of ["NEXT_PUBLIC_PROGRAM_ID", "NEXT_PUBLIC_TUSDC_MINT", "NEXT_PUBLIC_CONFIG_ADMIN", "NEXT_PUBLIC_FEE_PAYER_PUBKEY", "RESOLVER_SECRET"])
    if (!process.env[v]) fail(`${v} missing from .env.local`);

  const { Keypair, sendAndConfirmTransaction } = await import("@solana/web3.js");
  const { anchorChain: chain } = await import("../src/chain/anchor");
  const { buildProposeTx } = await import("../src/chain/tx");
  const { connection } = await import("../src/chain/relay");
  const { keypairWallet } = await import("../src/wallet/burner");

  const [A, B, C] = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
  const [wa, wb, wc] = [A, B, C].map(keypairWallet);

  console.log("▶ faucet ×3");
  for (const k of [A, B, C]) {
    const r = await fetch(`${APP}/api/faucet`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ wallet: k.publicKey.toBase58() }),
    });
    if (!r.ok) fail(`faucet ${r.status}: ${await r.text()} (is \`npm run dev\` running?)`);
  }

  console.log(`▶ create market, deadline in ${DEADLINE_S} s`);
  const text = "iOS 26 will be available as a free software update for iPhone this fall.";
  const sourceUrl = "https://www.apple.com/newsroom/2025/06/apple-elevates-the-iphone-experience-with-ios-26/";
  const { id } = await chain.createMarket(wa, {
    promiser: "Apple", promiserType: "organization", promiseText: text,
    question: "Did Apple release iOS 26 to the public?",
    deadline: new Date(Date.now() + DEADLINE_S * 1000).toISOString(),
    criteriaKept: "iOS 26 publicly released to iPhone users.",
    criteriaBroken: "iOS 26 not publicly released.",
    checkSource: "Apple Newsroom, major tech press", assumptions: [],
    sourceUrl, sourceHash: createHash("sha256").update(text).digest("hex"),
  });
  console.log(`  market #${id}`);

  console.log("▶ stakes: 10 Broken · 15 Broken · 75 Kept");
  await chain.stake(wa, id, "broken", 10);
  await chain.stake(wb, id, "broken", 15);
  await chain.stake(wc, id, "kept", 75);

  const m = await chain.getMarket(id);
  if (!m) fail(`market #${id} not found`);
  console.log(`▶ waiting for the deadline (${new Date(m!.deadline * 1000).toLocaleTimeString()})`);
  while (Date.now() < m!.deadline * 1000 + 3_000) await wait(1_000);

  if (process.argv.includes("--propose")) {
    const resolver = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.RESOLVER_SECRET!)));
    const tx = await buildProposeTx(resolver.publicKey, id, "kept", 9500,
      "Apple released iOS 26 to the public on September 15, 2025.", [sourceUrl], new Uint8Array(32));
    await sendAndConfirmTransaction(connection(), tx, [resolver], { commitment: "confirmed" });
    console.log("  proposed Kept (95%); the challenge window is running");
  }

  console.log(`\n✅ market #${id} is past its deadline: ${APP}/markets/${id}`);
  if (!process.argv.includes("--propose")) console.log('   Open it and click "Run resolution".');
}

main().catch((e) => fail(String(e?.error?.errorCode?.code ?? e?.message ?? e)));
