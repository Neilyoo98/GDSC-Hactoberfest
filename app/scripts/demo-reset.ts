// app/scripts/demo-reset.ts    OWNER: P4
// Before each rehearsal: top demo wallets back up to 100 tUSDC, run P2's seed, print market URLs.
// Usage: npm run demo:reset            (DEMO_WALLETS=pk1,pk2,... in .env.local)
//        npm run demo:reset -- --no-seed
import { loadEnvFile } from "node:process";
import { execSync } from "child_process";

// constants.ts reads env at import time, so load .env.local before importing chain code.
try { loadEnvFile(".env.local"); } catch {}

const TARGET = 100;
const APP = process.env.APP_URL ?? "http://localhost:3000";
const PUBLIC = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");

async function main() {
  const { Keypair, PublicKey } = await import("@solana/web3.js");
  const { getOrCreateAssociatedTokenAccount, mintTo } = await import("@solana/spl-token");
  const { connection } = await import("../src/chain/relay");
  const { mint } = await import("../src/chain/pdas");
  const { anchorChain } = await import("../src/chain/anchor");

  if (!process.env.FEE_PAYER_SECRET) throw new Error("FEE_PAYER_SECRET missing from .env.local");
  const wallets = (process.env.DEMO_WALLETS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!wallets.length) throw new Error("Set DEMO_WALLETS=pk1,pk2,... in .env.local");

  const conn = connection();
  // Mint authority = fee payer (P2's setup-devnet.ts).
  const feePayer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.FEE_PAYER_SECRET)));
  const sol = (await conn.getBalance(feePayer.publicKey)) / 1e9;
  console.log(`fee payer ${feePayer.publicKey.toBase58()}: ${sol.toFixed(3)} SOL${sol < 0.5 ? "  ⚠ LOW, airdrop now" : ""}`);

  for (const w of wallets) {
    const ata = await getOrCreateAssociatedTokenAccount(conn, feePayer, mint(), new PublicKey(w));
    const have = Number(ata.amount) / 1e6;
    const top = Math.max(0, TARGET - have);
    if (top > 0) await mintTo(conn, feePayer, mint(), ata.address, feePayer, BigInt(Math.round(top * 1e6)));
    console.log(`  ${w.slice(0, 6)}…  ${have} → ${have + top} tUSDC`);
  }

  if (!process.argv.includes("--no-seed")) {
    console.log("\nseeding demo markets (P2's seed.ts)…");
    execSync("npm run seed", { stdio: "inherit" });
  }

  console.log("\nmarkets:");
  for (const m of await anchorChain.listMarkets()) {
    const blink = PUBLIC ? `  ·  Blink: https://dial.to/?action=solana-action:${PUBLIC}/api/actions/stake?market=${m.id}&cluster=devnet` : "";
    console.log(`  #${m.id} ${m.status.padEnd(10)} ${APP}/markets/${m.id}${blink}`);
  }
  console.log("\n✅ demo reset. Remember: window must be 30 s (P1 runs update_config if not).");
}

main().catch((e) => { console.error("❌", e?.message ?? e); process.exit(1); });
