// app/src/chain/program.ts    OWNER: P4
// One read-only Anchor Program instance. Signing never happens here; see relay.ts.
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import { IDL, type Kept } from "../shared/idl/kept";
import { connection } from "./relay";

const readOnlyWallet = {
  publicKey: Keypair.generate().publicKey,
  signTransaction: async () => { throw new Error("read-only provider"); },
  signAllTransactions: async () => { throw new Error("read-only provider"); },
};

let _p: Program<Kept> | null = null;
export function program(): Program<Kept> {
  // Anchor 0.30: the program id comes from idl.address.
  return (_p ??= new Program<Kept>(IDL, new AnchorProvider(connection(), readOnlyWallet as any, { commitment: "confirmed" })));
}
