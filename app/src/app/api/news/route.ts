// GET → { items: NewsPromise[], fetchedAt } : recent public promises with deadlines.
import { NextResponse } from 'next/server';
import { ServiceError } from '@/server/errors';
import { promisesInTheNews } from '@/server/context/news';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  // ?fresh=1 skips the 30-minute cache, in development only.
  const fresh = process.env.NODE_ENV !== 'production' && new URL(request.url).searchParams.get('fresh') === '1';
  try {
    return NextResponse.json(await promisesInTheNews(fresh), {
      headers: { 'cache-control': 'public, max-age=300' },
    });
  } catch (error) {
    const known = error instanceof ServiceError;
    return NextResponse.json(
      { error: known ? error.message : 'Live news is unavailable.', code: known ? error.code : 'news_failed' },
      { status: known ? error.status : 502 },
    );
  }
}
