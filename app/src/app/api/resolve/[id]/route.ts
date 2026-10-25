import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ServiceError } from '@/server/errors';
import { resolveMarket } from '@/server/orchestrator/resolveMarket';
import { getTrace } from '@/server/orchestrator/trace';

export const runtime = 'nodejs';
const RequestSchema = z.object({ dryRun: z.boolean().optional() }).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { id: value } = await params;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 0)
    return NextResponse.json({ error: 'Invalid market id.' }, { status: 400 });
  return NextResponse.json({ trace: getTrace(id) });
}

export async function POST(request: Request, { params }: RouteContext) {
  const { id: value } = await params;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 0)
    return NextResponse.json({ error: 'Invalid market id.' }, { status: 400 });
  let body: unknown = {};
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 }); }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: 'Invalid resolution request.' }, { status: 400 });
  try {
    return NextResponse.json(await resolveMarket(id, parsed.data));
  } catch (error) {
    const known = error instanceof ServiceError;
    return NextResponse.json(
      { error: known ? error.message : 'Could not resolve this market.', code: known ? error.code : 'resolve_failed' },
      { status: known ? error.status : 502 },
    );
  }
}
