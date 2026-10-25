// app/src/chain/program.ts    OWNER: P4
// One read-only Anchor Program instance. Signing never happens here; see relay.ts.
import { AnchorProvider, Program, type Wallet } from "@coral-xyz/anchor";
import { Keypair, type Transaction, type VersionedTransaction } from "@solana/web3.js";
import { IDL, type Kept } from "../shared/idl/kept";
import { connection } from "./relay";

const readOnlyKeypair = Keypair.generate();
const readOnlyWallet: Wallet = {
  payer: readOnlyKeypair,
  publicKey: readOnlyKeypair.publicKey,
  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    void transaction;
    throw new Error("read-only provider");
  },
  async signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]> {
    void transactions;
    throw new Error("read-only provider");
  },
};

let _p: Program<Kept> | null = null;
export function program(): Program<Kept> {
  // Anchor 0.30: the program id comes from idl.address.
  return (_p ??= new Program<Kept>(IDL, new AnchorProvider(connection(), readOnlyWallet, { commitment: "confirmed" })));
}
