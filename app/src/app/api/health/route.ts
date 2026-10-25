import { NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { connection } from '@/chain/relay';
import { FEE_PAYER_PUBKEY, PROGRAM_ID } from '@/shared/constants';

export const runtime = 'nodejs';

export async function GET() {
  let rpc: 'ok' | 'error' = 'error';
  let feePayerSol: number | null = null;
  try {
    const conn = connection();
    await conn.getLatestBlockhash('confirmed');
    rpc = 'ok';
    if (FEE_PAYER_PUBKEY)
      feePayerSol = (await conn.getBalance(new PublicKey(FEE_PAYER_PUBKEY), 'confirmed')) / 1_000_000_000;
  } catch { /* health response stays useful if RPC is unavailable */ }
  return NextResponse.json({
    rpc,
    openai: Boolean(process.env.OPENAI_API_KEY),
    tavily: Boolean(process.env.TAVILY_API_KEY),
    feePayerSol,
    programId: PROGRAM_ID || null,
  });
}
