// The relay must never pay for anything except approved Kept instructions.
// Validation runs before any network call, so these tests stay offline.
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

const PROGRAM = 'GYupVpsMEY12UGgS1gUdabq4UvmbR6PvbmUewQbw7gap';
const programId = new PublicKey(PROGRAM);
const feePayer = Keypair.generate();
const user = Keypair.generate();
const disc = (name: string) => createHash('sha256').update(`global:${name}`).digest().subarray(0, 8);
const ix = (name: string) =>
  new TransactionInstruction({
    programId,
    keys: [{ pubkey: user.publicKey, isSigner: true, isWritable: true }],
    data: Buffer.concat([disc(name), Buffer.alloc(9)]),
  });

function encode(ixs: TransactionInstruction[], opts: { payer?: PublicKey; sign?: boolean } = {}) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = opts.payer ?? feePayer.publicKey;
  tx.recentBlockhash = Keypair.generate().publicKey.toBase58();
  if (opts.sign !== false) tx.partialSign(user);
  return { tx: tx.serialize({ requireAllSignatures: false }).toString('base64') };
}

let relayTransaction: (value: unknown) => Promise<string>;
beforeEach(async () => {
  vi.stubEnv('FEE_PAYER_SECRET', JSON.stringify(Array.from(feePayer.secretKey)));
  vi.stubEnv('NEXT_PUBLIC_FEE_PAYER_PUBKEY', feePayer.publicKey.toBase58());
  vi.stubEnv('NEXT_PUBLIC_PROGRAM_ID', PROGRAM);
  vi.resetModules(); // constants.ts reads env at import time
  ({ relayTransaction } = await import('./relay'));
});

const rejects = (value: unknown, msg: RegExp) =>
  expect(relayTransaction(value)).rejects.toMatchObject({ code: 'invalid_relay', message: expect.stringMatching(msg) });

describe('relayTransaction validation', () => {
  it('passes a signed place_stake (fails only at the offline send step)', async () => {
    await expect(relayTransaction(encode([ix('place_stake')]))).rejects.toMatchObject({ code: 'relay_failed' });
  });

  it('refuses a transaction whose fee payer is not the relay', () =>
    rejects(encode([ix('place_stake')], { payer: user.publicKey }), /fee payer/));

  it('refuses a SystemProgram transfer that would drain the fee payer', () =>
    rejects(
      encode([ix('place_stake'), SystemProgram.transfer({ fromPubkey: feePayer.publicKey, toPubkey: user.publicKey, lamports: 1e9 })]),
      /unapproved program/,
    ));

  it('refuses Kept instructions users must not relay (propose_outcome)', () =>
    rejects(encode([ix('propose_outcome')]), /unsupported market instruction/));

  it('refuses a transaction without the user signature', () =>
    rejects(encode([ix('place_stake')], { sign: false }), /signature/));

  it('refuses a huge priority fee', () =>
    rejects(encode([ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000_000 }), ix('place_stake')]), /compute budget/));

  it('refuses two market instructions in one transaction', () =>
    rejects(encode([ix('place_stake'), ix('claim')]), /one market instruction/));
});
