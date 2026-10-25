// app/src/chain/relay.ts    OWNER: P4
// The gasless send path. tx.ts builds a Transaction; this signs it with the user's wallet and ships it
// to P2's /api/relay, which co-signs as fee payer. NEXT_PUBLIC_GASLESS=0 sends directly (user pays).
import { Connection, PublicKey, type Transaction } from "@solana/web3.js";
import type { WalletLike } from "./index";
import type { RelayRequest } from "../shared/types";
import { FEE_PAYER_PUBKEY } from "../shared/constants";

const DEVNET = "https://api.devnet.solana.com";
// Server and scripts prefer SOLANA_RPC_URL (PLAN: Helius goes in both RPC vars); the browser only sees NEXT_PUBLIC_.
const RPC =
  (typeof window === "undefined" ? process.env.SOLANA_RPC_URL : undefined) ||
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  DEVNET;
export const GASLESS = process.env.NEXT_PUBLIC_GASLESS !== "0";
// Browser: "" so /api/relay is relative. Node (smoke script): the running dev server.
const APP_URL = typeof window === "undefined" ? (process.env.APP_URL ?? "http://localhost:3000") : "";

let _conn: Connection | null = null;
export const connection = () => (_conn ??= new Connection(RPC, "confirmed"));

/** Who pays fees + rent: the server fee payer, or the user when GASLESS=0. */
export function feePayerFor(user: PublicKey): PublicKey {
  if (!GASLESS) return user;
  if (!FEE_PAYER_PUBKEY) throw new Error("NEXT_PUBLIC_FEE_PAYER_PUBKEY not set");
  return new PublicKey(FEE_PAYER_PUBKEY);
}

export function needsSignature(tx: Transaction, who: PublicKey): boolean {
  const msg = tx.compileMessage();
  return msg.accountKeys.slice(0, msg.header.numRequiredSignatures).some((k) => k.equals(who));
}

export async function send(w: WalletLike, tx: Transaction): Promise<string> {
  const conn = connection();
  // Fresh blockhash right before signing, never at page load.
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.feePayer = feePayerFor(w.publicKey);
  // Permissionless ixs (finalize) don't list the user, so don't ask the wallet to sign them.
  const signed = needsSignature(tx, w.publicKey) ? await w.signTransaction(tx) : tx;

  if (!GASLESS) {
    const sig = await conn.sendRawTransaction(signed.serialize());
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  }

  const body: RelayRequest = { tx: Buffer.from(signed.serialize({ requireAllSignatures: false })).toString("base64") };
  const r = await fetch(`${APP_URL}/api/relay`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ?? `relay ${r.status}`);
  return j.signature as string;
}

export const explorerTx = (sig: string) => `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
