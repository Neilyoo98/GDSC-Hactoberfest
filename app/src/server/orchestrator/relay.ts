import 'server-only';

import { createHash } from 'node:crypto';
import {
  ComputeBudgetProgram,
  Transaction,
} from '@solana/web3.js';
import { z } from 'zod';
import { FEE_PAYER_PUBKEY, PROGRAM_ID } from '@/shared/constants';
import { connection } from '@/chain/relay';
import { ServiceError } from '../errors';
import { keypairFromEnv } from './keys';

const RelayRequestSchema = z.object({ tx: z.string().min(1).max(4096) }).strict();
const instructions = new Map(
  ['create_market', 'place_stake', 'challenge', 'council_vote', 'finalize', 'claim'].map(
    (name) => [createHash('sha256').update(`global:${name}`).digest().subarray(0, 8).toString('hex'), name],
  ),
);

function validateComputeBudget(data: Buffer): boolean {
  if (data[0] === 2 && data.length === 5) {
    const units = data.readUInt32LE(1);
    return units > 0 && units <= 1_400_000;
  }
  if (data[0] === 3 && data.length === 9) {
    return data.readBigUInt64LE(1) <= BigInt(10_000_000);
  }
  return false;
}

export async function relayTransaction(value: unknown): Promise<string> {
  const parsed = RelayRequestSchema.safeParse(value);
  if (!parsed.success)
    throw new ServiceError('Provide a valid serialized transaction.', 'invalid_relay', 400);
  const binary = Buffer.from(parsed.data.tx, 'base64');
  if (
    binary.length > 1232 ||
    binary.toString('base64') !== parsed.data.tx
  ) throw new ServiceError('The transaction encoding is invalid.', 'invalid_relay', 400);

  const feePayer = keypairFromEnv('FEE_PAYER_SECRET');
  if (!FEE_PAYER_PUBKEY || feePayer.publicKey.toBase58() !== FEE_PAYER_PUBKEY)
    throw new ServiceError('The configured fee payer does not match its key.', 'server_configuration', 503);

  let tx: Transaction;
  try { tx = Transaction.from(binary); }
  catch { throw new ServiceError('The transaction could not be decoded.', 'invalid_relay', 400); }

  if (!tx.feePayer?.equals(feePayer.publicKey))
    throw new ServiceError('Transaction fee payer is not the configured relay wallet.', 'invalid_relay', 400);
  if (!tx.recentBlockhash || !tx.verifySignatures(false))
    throw new ServiceError('The user signature is missing or invalid.', 'invalid_relay', 400);

  let appInstructionCount = 0;
  for (const instruction of tx.instructions) {
    if (instruction.programId.equals(ComputeBudgetProgram.programId)) {
      if (!validateComputeBudget(instruction.data))
        throw new ServiceError('The transaction has an unsupported compute budget instruction.', 'invalid_relay', 400);
      continue;
    }
    if (instruction.programId.toBase58() !== PROGRAM_ID)
      throw new ServiceError('The transaction contains an unapproved program.', 'invalid_relay', 400);
    appInstructionCount += 1;
    const discriminator = instruction.data.subarray(0, 8).toString('hex');
    if (!instructions.has(discriminator))
      throw new ServiceError('The transaction contains an unsupported market instruction.', 'invalid_relay', 400);
  }
  if (appInstructionCount !== 1 || tx.instructions.length > 3)
    throw new ServiceError('The relay accepts one market instruction and up to two compute settings.', 'invalid_relay', 400);

  const message = tx.compileMessage();
  const requiredSigners = message.accountKeys.slice(0, message.header.numRequiredSignatures);
  const unexpectedSigners = requiredSigners.filter((key) => !key.equals(feePayer.publicKey));
  if (unexpectedSigners.length > 1)
    throw new ServiceError('The transaction has unexpected required signers.', 'invalid_relay', 400);
  if (unexpectedSigners.some((key) =>
    !tx.signatures.some((entry) => entry.publicKey.equals(key) && entry.signature),
  ))
    throw new ServiceError('The transaction is missing the connected wallet signature.', 'invalid_relay', 400);

  tx.partialSign(feePayer);
  let signature: string;
  try {
    signature = await connection().sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    const confirmation = await connection().confirmTransaction(signature, 'confirmed');
    if (confirmation.value.err)
      throw new Error('The transaction failed on chain.');
  } catch (error) {
    throw new ServiceError(
      error instanceof Error ? error.message.slice(0, 180) : 'The transaction failed on chain.',
      'relay_failed',
      502,
    );
  }
  return signature;
}
