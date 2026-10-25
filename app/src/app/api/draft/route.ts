import { NextResponse } from 'next/server';
import { DraftRequestSchema } from '@/shared/draftSchemas';
import { ServiceError, isTimeout } from '@/server/errors';
import type { SourceDoc } from '../../../shared/types';
import { fetchXPost } from '../../../server/context/oembed';
import { extractArticle } from '../../../server/context/article';
import { sourceFromText } from '../../../server/context/source';
import { draftMarket } from '../../../server/intelligence/drafter';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }
  const parsed = DraftRequestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request.' },
      { status: 400 },
    );

  let stage: 'source' | 'draft' = 'source';
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(90_000)]);
  try {
    let source: SourceDoc;
    if (parsed.data.text)
      source = sourceFromText(parsed.data.text, parsed.data.url ?? null);
    else if (parsed.data.url) {
      const hostname = new URL(parsed.data.url).hostname
        .toLowerCase()
        .replace(/^www\./u, '');
      source =
        hostname === 'x.com' || hostname === 'twitter.com'
          ? await fetchXPost(parsed.data.url, signal)
          : await extractArticle(parsed.data.url, signal);
    } else
      return NextResponse.json(
        { error: 'Provide a URL or source text.' },
        { status: 400 },
      );

    stage = 'draft';
    return NextResponse.json(
      await draftMarket(source, undefined, signal, parsed.data.guidance),
    );
  } catch (error) {
    const canPasteSource =
      stage === 'source' && Boolean(parsed.data.url) && !parsed.data.text;
    const known = error instanceof ServiceError;
    const timeout = isTimeout(error);
    const message = known
      ? error.message
      : timeout
        ? 'The request took too long. Please try again.'
        : canPasteSource
          ? 'Could not read that source. Paste the relevant text from the linked page below.'
          : 'Could not generate a draft. Please try again.';
    return NextResponse.json(
      {
        error: message,
        code: known
          ? error.code
          : timeout
            ? 'request_timeout'
            : canPasteSource
              ? 'source_unavailable'
              : 'draft_failed',
        canPasteSource,
      },
      { status: known ? error.status : timeout ? 504 : 502 },
    );
  }
}
