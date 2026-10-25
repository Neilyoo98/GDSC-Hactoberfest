import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ServiceError } from '@/server/errors';
import { dispenseTestTokens } from '@/server/orchestrator/faucet';

export const runtime = 'nodejs';
const RequestSchema = z.object({ wallet: z.string().min(32).max(64) }).strict();

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: 'Provide a valid wallet public key.' }, { status: 400 });
  try {
    return NextResponse.json(await dispenseTestTokens(parsed.data));
  } catch (error) {
    const known = error instanceof ServiceError;
    return NextResponse.json(
      { error: known ? error.message : 'The test-token faucet is unavailable.', code: known ? error.code : 'faucet_failed' },
      { status: known ? error.status : 502 },
    );
  }
}
