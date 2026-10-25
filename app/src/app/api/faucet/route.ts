// OWNER: P1 (taken over from P2). POST { wallet } → { signature, amount } | { error: "already_claimed" }
import { NextResponse } from 'next/server';
import { ServiceError } from '@/server/errors';
import { claimFaucet } from '@/server/orchestrator/faucet';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: { wallet?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (typeof body.wallet !== 'string' || !body.wallet)
    return NextResponse.json({ error: 'Provide wallet (a public key).' }, { status: 400 });
  try {
    return NextResponse.json(await claimFaucet(body.wallet));
  } catch (error) {
    if (error instanceof ServiceError)
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    return NextResponse.json({ error: 'The faucet could not send tokens. Try again.', code: 'faucet_failed' }, { status: 502 });
  }
}
