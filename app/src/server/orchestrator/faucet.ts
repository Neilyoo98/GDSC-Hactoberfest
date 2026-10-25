import 'server-only';

import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
  getMint,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { PublicKey, Transaction } from '@solana/web3.js';
import { TUSDC_DECIMALS, TUSDC_MINT } from '@/shared/constants';
import { connection } from '@/chain/relay';
import { ServiceError } from '../errors';
import { keypairFromEnv } from './keys';

const FAUCET_AMOUNT = 100 * 10 ** TUSDC_DECIMALS;

export async function dispenseTestTokens(value: unknown): Promise<{ signature: string; amount: number }> {
  if (!value || typeof value !== 'object' || !('wallet' in value) || typeof value.wallet !== 'string')
    throw new ServiceError('Provide a wallet public key.', 'invalid_faucet', 400);

  let owner: PublicKey;
  let mint: PublicKey;
  try {
    owner = new PublicKey(value.wallet);
    mint = new PublicKey(TUSDC_MINT);
  } catch {
    throw new ServiceError('The wallet or test-token mint address is invalid.', 'invalid_faucet', 400);
  }
  const rpcUrl = process.env.SOLANA_RPC_URL ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? '';
  if (/mainnet/iu.test(rpcUrl))
    throw new ServiceError('The test-token faucet is disabled on mainnet.', 'wrong_cluster', 503);

  const payer = keypairFromEnv('FEE_PAYER_SECRET');
  const conn = connection();
  const mintInfo = await getMint(conn, mint, 'confirmed', TOKEN_PROGRAM_ID);
  if (mintInfo.decimals !== TUSDC_DECIMALS || !mintInfo.mintAuthority?.equals(payer.publicKey))
    throw new ServiceError('The configured test-token mint is not controlled by the faucet wallet.', 'server_configuration', 503);

  const destination = getAssociatedTokenAddressSync(mint, owner);
  if (await conn.getAccountInfo(destination, 'confirmed'))
    throw new ServiceError('This wallet has already claimed its test-token allocation.', 'already_claimed', 409);

  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer.publicKey,
      destination,
      owner,
      mint,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID,
    ),
    createMintToInstruction(mint, destination, payer.publicKey, FAUCET_AMOUNT),
  );
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(payer);
  try {
    const signature = await conn.sendRawTransaction(tx.serialize());
    const confirmation = await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
    if (confirmation.value.err) throw new Error('Faucet transaction failed on chain.');
    return { signature, amount: 100 };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/already in use|account.*exists/iu.test(message))
      throw new ServiceError('This wallet has already claimed its test-token allocation.', 'already_claimed', 409);
    throw new ServiceError('The faucet could not send test tokens. Check the fee-payer balance and try again.', 'faucet_failed', 502);
  }
}
