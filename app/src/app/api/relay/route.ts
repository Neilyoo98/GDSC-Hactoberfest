// OWNER: P1 (taken over from P2). POST { tx: base64 user-signed } → { signature }
import { NextResponse } from 'next/server';
import { ServiceError } from '@/server/errors';
import { relayTransaction } from '@/server/orchestrator/relay';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: { tx?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }
  if (typeof body.tx !== 'string' || !body.tx)
    return NextResponse.json({ error: 'Provide tx (base64).' }, { status: 400 });
  try {
    return NextResponse.json({ signature: await relayTransaction(body.tx) });
  } catch (error) {
    if (error instanceof ServiceError)
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    // Program errors come back from simulation; pass the program's message so the UI can explain it.
    const logs: string[] = (error as { logs?: string[] })?.logs ?? [];
    const anchor = logs.find((l) => l.includes('Error Code:'));
    return NextResponse.json(
      { error: anchor ? anchor.replace(/^.*Error Code: /, '') : 'The transaction could not be sent.', code: 'send_failed' },
      { status: 400 },
    );
  }
}
