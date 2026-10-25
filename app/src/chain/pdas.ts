// app/src/chain/pdas.ts    OWNER: P4
// Seeds match the IDL (app/src/shared/idl/kept.json):
//   Config   ["config", admin]
//   Market   ["market", config, id u64 LE]
//   Vault    ["vault", market]
//   Position ["position", market, user]
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { CONFIG_ADMIN, PROGRAM_ID, SEEDS, TUSDC_MINT } from "../shared/constants";

export const programId = () => new PublicKey(PROGRAM_ID);
export const mint = () => new PublicKey(TUSDC_MINT);
export const configAdmin = () => new PublicKey(CONFIG_ADMIN);

const pda = (...seeds: (Buffer | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds, programId())[0];

const u64le = (n: number) => {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
};

export const configPda = (admin = configAdmin()) => pda(Buffer.from(SEEDS.config), admin.toBuffer());
export const marketPda = (id: number, config = configPda()) =>
  pda(Buffer.from(SEEDS.market), config.toBuffer(), u64le(id));
export const vaultPda = (market: PublicKey) => pda(Buffer.from(SEEDS.vault), market.toBuffer());
export const positionPda = (market: PublicKey, user: PublicKey) =>
  pda(Buffer.from(SEEDS.position), market.toBuffer(), user.toBuffer());
export const userAta = (user: PublicKey) => getAssociatedTokenAddressSync(mint(), user);
