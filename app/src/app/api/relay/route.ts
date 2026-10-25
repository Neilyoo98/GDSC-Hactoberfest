import { NextResponse } from 'next/server';
import { ServiceError } from '@/server/errors';
import { relayTransaction } from '@/server/orchestrator/relay';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  try {
    return NextResponse.json({ signature: await relayTransaction(body) });
  } catch (error) {
    const known = error instanceof ServiceError;
    return NextResponse.json(
      { error: known ? error.message : 'The transaction relay is unavailable.', code: known ? error.code : 'relay_failed' },
      { status: known ? error.status : 502 },
    );
  }
}
