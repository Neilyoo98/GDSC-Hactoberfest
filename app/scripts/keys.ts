// OWNER: P1 (taken over from P2). Generates the server fee payer and resolver keys
// into .env.local (never printed, never committed). Safe to re-run: existing keys are kept.
//   npm run keys
import { Keypair } from "@solana/web3.js";
import { readEnv, setEnv } from "./env-file";

const env = readEnv();

function ensure(name: "FEE_PAYER_SECRET" | "RESOLVER_SECRET"): Keypair {
  if (env[name]) {
    const kp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(env[name])));
    console.log(`kept existing ${name.padEnd(17)} ${kp.publicKey.toBase58()}`);
    return kp;
  }
  const kp = Keypair.generate();
  setEnv(name, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`created ${name.padEnd(24)} ${kp.publicKey.toBase58()}`);
  return kp;
}

const feePayer = ensure("FEE_PAYER_SECRET");
const resolver = ensure("RESOLVER_SECRET");

// The fee payer is also the tUSDC mint authority and the Config admin (Config = ["config", admin]).
setEnv("NEXT_PUBLIC_FEE_PAYER_PUBKEY", feePayer.publicKey.toBase58());
setEnv("NEXT_PUBLIC_CONFIG_ADMIN", feePayer.publicKey.toBase58());

console.log(`
Next: fund both on devnet (the fee payer pays rent + fees for users; the resolver signs proposals):
  fee payer  ${feePayer.publicKey.toBase58()}   ~1 SOL
  resolver   ${resolver.publicKey.toBase58()}   ~0.1 SOL
then run: npm run setup:devnet`);
