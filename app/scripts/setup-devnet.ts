// OWNER: P1 (taken over from P2). One-time devnet setup for the app:
//   1. tUSDC mint (6 decimals, authority = fee payer)
//   2. the app's Config: initialize_config(resolver, council[3], challenge window, 10 tUSDC bond)
// Safe to re-run: reuses the mint and config, and only updates config values that differ.
//   npm run setup:devnet            (CHALLENGE_WINDOW=86400 for production timing)
import { AnchorProvider, BN, Program, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";
import { IDL, type Kept } from "../src/shared/idl/kept";
import { readEnv, setEnv } from "./env-file";

const env = readEnv();
const die = (msg: string): never => {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
};
const explorer = (a: string) => `https://explorer.solana.com/address/${a}?cluster=devnet`;
const key = (name: string) => {
  if (!env[name]) die(`${name} is empty in .env.local. Run: npm run keys`);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(env[name])));
};

async function main() {
  const feePayer = key("FEE_PAYER_SECRET");
  const resolver = key("RESOLVER_SECRET");
  const council = (env.COUNCIL_PUBKEYS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (council.length !== 3) die("COUNCIL_PUBKEYS must list exactly 3 public keys (comma-separated).");
  const councilKeys = council.map((c) => new PublicKey(c));
  const window = Number(process.env.CHALLENGE_WINDOW ?? env.CHALLENGE_WINDOW ?? 30);
  const BOND = 10_000_000; // 10 tUSDC

  const conn = new Connection(env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const sol = (await conn.getBalance(feePayer.publicKey)) / LAMPORTS_PER_SOL;
  console.log(`fee payer ${feePayer.publicKey.toBase58()}  ${sol.toFixed(3)} SOL`);
  if (sol < 0.05) die(`Fund the fee payer with ~1 devnet SOL first: ${feePayer.publicKey.toBase58()}`);

  // 1. Mint
  let mint = env.NEXT_PUBLIC_TUSDC_MINT ? new PublicKey(env.NEXT_PUBLIC_TUSDC_MINT) : null;
  if (mint && !(await conn.getAccountInfo(mint))) mint = null;
  if (!mint) {
    mint = await createMint(conn, feePayer, feePayer.publicKey, null, 6);
    setEnv("NEXT_PUBLIC_TUSDC_MINT", mint.toBase58());
    console.log(`✓ created tUSDC mint ${mint.toBase58()}`);
  } else console.log(`✓ tUSDC mint exists ${mint.toBase58()}`);

  // 2. Config
  const program = new Program<Kept>(IDL, new AnchorProvider(conn, new Wallet(feePayer), { commitment: "confirmed" }));
  const [config] = PublicKey.findProgramAddressSync([Buffer.from("config"), feePayer.publicKey.toBuffer()], program.programId);
  const existing = await program.account.config.fetchNullable(config);
  if (!existing) {
    await program.methods
      .initializeConfig(resolver.publicKey, councilKeys, new BN(window), new BN(BOND))
      .accountsPartial({ admin: feePayer.publicKey, config, mint })
      .rpc();
    console.log(`✓ initialized config ${config.toBase58()}`);
  } else {
    if (!existing.mint.equals(mint)) die(`Config already uses mint ${existing.mint.toBase58()}; set NEXT_PUBLIC_TUSDC_MINT to it.`);
    const same =
      existing.resolver.equals(resolver.publicKey) &&
      existing.challengeWindow.toNumber() === window &&
      existing.council.every((k, i) => k.equals(councilKeys[i]));
    if (same) console.log(`✓ config exists and matches ${config.toBase58()}`);
    else {
      await program.methods
        .updateConfig(resolver.publicKey, councilKeys, new BN(window))
        .accountsPartial({ admin: feePayer.publicKey, config })
        .rpc();
      console.log(`✓ updated config ${config.toBase58()} (resolver / council / window)`);
    }
  }

  const c = await program.account.config.fetch(config);
  console.log(`
Program   ${program.programId.toBase58()}
Config    ${config.toBase58()}   ${explorer(config.toBase58())}
Mint      ${mint.toBase58()}
Resolver  ${c.resolver.toBase58()}
Council   ${c.council.map((k: PublicKey) => k.toBase58()).join("\n          ")}
Window    ${c.challengeWindow.toString()} s   Bond ${c.bond.toNumber() / 1e6} tUSDC   Markets ${c.marketCount.toString()}

.env.local is updated. Set NEXT_PUBLIC_CHAIN=anchor and restart the dev server to use the real chain.`);
}

main().catch((e) => die(e?.message ?? String(e)));
