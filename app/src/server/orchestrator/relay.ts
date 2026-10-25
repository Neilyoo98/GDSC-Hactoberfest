// OWNER: P1 (taken over from P2). The gasless path: co-sign user transactions as fee payer.
// Security-critical: the fee payer only signs transactions that ONLY call the Kept program
// (plus bounded ComputeBudget settings), so nobody can drain it with a SystemProgram transfer.
import 'server-only';
import { ComputeBudgetProgram, PublicKey, Transaction } from '@solana/web3.js';
import { PROGRAM_ID } from '@/shared/constants';
import { ServiceError } from '../errors';
import { feePayerKey, serverConnection } from './keys';

const MAX_INSTRUCTIONS = 4;
const MAX_CU_PRICE_MICROLAMPORTS = BigInt(1_000_000); // priority fee cap the fee payer will pay (no 0n literals: ES2017 target)
const MAX_CU_LIMIT = 1_400_000;
const CU_SET_LIMIT = 2;
const CU_SET_PRICE = 3;

const reject = (message: string): never => {
  throw new ServiceError(message, 'relay_rejected', 400);
};

/** Pure check (unit-tested): throws a 400 ServiceError if the fee payer must not sign `tx`. */
export function validateRelayTx(tx: Transaction, feePayer: PublicKey, programId: PublicKey): void {
  if (!tx.feePayer?.equals(feePayer)) reject('Transaction fee payer must be the Kept relay.');
  if (tx.instructions.length === 0 || tx.instructions.length > MAX_INSTRUCTIONS)
    reject(`Transaction must have 1-${MAX_INSTRUCTIONS} instructions.`);
  let keptCalls = 0;
  for (const ix of tx.instructions) {
    if (ix.programId.equals(programId)) {
      keptCalls++;
      continue;
    }
    if (ix.programId.equals(ComputeBudgetProgram.programId)) {
      const kind = ix.data[0];
      if (kind === CU_SET_LIMIT && ix.data.length >= 5) {
        if (ix.data.readUInt32LE(1) > MAX_CU_LIMIT) reject('Compute unit limit is too high.');
        continue;
      }
      if (kind === CU_SET_PRICE && ix.data.length >= 9) {
        if (ix.data.readBigUInt64LE(1) > MAX_CU_PRICE_MICROLAMPORTS) reject('Priority fee is too high.');
        continue;
      }
      reject('Unsupported ComputeBudget instruction.');
    }
    reject(`The relay only pays for Kept transactions (got program ${ix.programId.toBase58()}).`);
  }
  if (keptCalls === 0) reject('Transaction does not call the Kept program.');
}

/** Validate, co-sign as fee payer, send and confirm. Returns the signature. */
export async function relayTransaction(base64: string): Promise<string> {
  let tx: Transaction;
  try {
    tx = Transaction.from(Buffer.from(base64, 'base64'));
  } catch {
    return reject('Could not decode the transaction.');
  }
  const feePayer = feePayerKey();
  validateRelayTx(tx, feePayer.publicKey, new PublicKey(PROGRAM_ID));

  tx.partialSign(feePayer);
  // Every other required signer (the user) must already have signed.
  if (!tx.verifySignatures(true)) reject('Transaction is missing a user signature.');

  const conn = serverConnection();
  const signature = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
  const res = await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  if (res.value.err) throw new ServiceError('The transaction failed on-chain.', 'tx_failed', 400);
  return signature;
}
