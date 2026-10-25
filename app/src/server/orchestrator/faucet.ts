// OWNER: P1 (taken over from P2). 100 tUSDC once per wallet. "Once" is enforced by the chain:
// if the wallet's tUSDC account already exists, it has claimed (or already holds tUSDC).
import 'server-only';
import { PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { TUSDC_BASE, TUSDC_MINT } from '@/shared/constants';
import { ServiceError } from '../errors';
import { feePayerKey, serverConnection } from './keys';

export const FAUCET_AMOUNT = 100; // tUSDC

export async function claimFaucet(wallet: string): Promise<{ signature: string; amount: number }> {
  let owner: PublicKey;
  try {
    owner = new PublicKey(wallet);
  } catch {
    throw new ServiceError('That is not a valid Solana wallet address.', 'invalid_wallet', 400);
  }
  if (!TUSDC_MINT)
    throw new ServiceError('NEXT_PUBLIC_TUSDC_MINT is not configured. Run npm run setup:devnet.', 'chain_not_configured', 503);

  const mint = new PublicKey(TUSDC_MINT);
  const conn = serverConnection();
  const feePayer = feePayerKey();
  const ata = getAssociatedTokenAddressSync(mint, owner, true);
  if (await conn.getAccountInfo(ata)) throw new ServiceError('already_claimed', 'already_claimed', 409);

  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(feePayer.publicKey, ata, owner, mint),
    createMintToInstruction(mint, ata, feePayer.publicKey, BigInt(FAUCET_AMOUNT * TUSDC_BASE)),
  );
  const signature = await sendAndConfirmTransaction(conn, tx, [feePayer], { commitment: 'confirmed' });
  return { signature, amount: FAUCET_AMOUNT };
}
