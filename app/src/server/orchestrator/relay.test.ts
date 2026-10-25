// OWNER: P1. The relay must never pay for anything except Kept transactions.
import { describe, expect, it } from 'vitest';
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import { validateRelayTx } from './relay';

const program = new PublicKey('GYupVpsMEY12UGgS1gUdabq4UvmbR6PvbmUewQbw7gap');
const feePayer = Keypair.generate().publicKey;
const user = Keypair.generate().publicKey;
const kept = () => new TransactionInstruction({ programId: program, keys: [{ pubkey: user, isSigner: true, isWritable: true }], data: Buffer.from([1, 2, 3]) });
const tx = (...ixs: TransactionInstruction[]) => {
  const t = new Transaction().add(...ixs);
  t.feePayer = feePayer;
  return t;
};
const check = (t: Transaction) => () => validateRelayTx(t, feePayer, program);

describe('validateRelayTx', () => {
  it('accepts a Kept instruction paid by the relay', () => {
    expect(check(tx(kept()))).not.toThrow();
  });

  it('accepts bounded ComputeBudget settings next to a Kept instruction', () => {
    expect(
      check(tx(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }), ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }), kept())),
    ).not.toThrow();
  });

  it('refuses a transaction whose fee payer is not the relay', () => {
    const t = tx(kept());
    t.feePayer = user;
    expect(check(t)).toThrow(/fee payer/);
  });

  it('refuses a SystemProgram transfer (would drain the fee payer)', () => {
    const drain = SystemProgram.transfer({ fromPubkey: feePayer, toPubkey: user, lamports: 1_000_000_000 });
    expect(check(tx(kept(), drain))).toThrow(/only pays for Kept/);
  });

  it('refuses an unknown program', () => {
    const other = new TransactionInstruction({ programId: Keypair.generate().publicKey, keys: [], data: Buffer.alloc(0) });
    expect(check(tx(other))).toThrow(/only pays for Kept/);
  });

  it('refuses a huge priority fee', () => {
    expect(check(tx(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000_000 }), kept()))).toThrow(/Priority fee/);
  });

  it('refuses ComputeBudget-only and oversized transactions', () => {
    expect(check(tx(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 })))).toThrow(/does not call the Kept/);
    expect(check(tx(kept(), kept(), kept(), kept(), kept()))).toThrow(/1-4 instructions/);
  });
});
