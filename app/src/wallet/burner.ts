// app/src/wallet/burner.ts    OWNER: P4
import { Keypair, type Transaction } from "@solana/web3.js";
import type { WalletLike } from "@/chain";

/** Works in Node and the browser. Used by the smoke script and tests. */
export function keypairWallet(kp: Keypair): WalletLike {
  return {
    publicKey: kp.publicKey,
    async signTransaction<T extends Transaction>(tx: T) {
      tx.partialSign(kp);
      return tx;
    },
  };
}

/** A throwaway wallet for tests. */
export const makeTestWallet = () => keypairWallet(Keypair.generate());

/** Browser only: a devnet keypair persisted in localStorage, for tests and users without Phantom. */
export function burnerKeypair(): Keypair {
  const KEY = "kept.burner";
  let secret: number[] | null = null;
  try { secret = JSON.parse(localStorage.getItem(KEY) ?? "null"); } catch {}
  const kp = secret ? Keypair.fromSecretKey(Uint8Array.from(secret)) : Keypair.generate();
  try { localStorage.setItem(KEY, JSON.stringify(Array.from(kp.secretKey))); } catch {}
  return kp;
}

export const burnerWallet = (): WalletLike => keypairWallet(burnerKeypair());
