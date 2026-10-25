import { DraftResponseSchema } from '../src/shared/draftSchemas';

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error('Usage: ai:try -- <x-post-or-article-url|text>');

  // Use the running app so server-only modules and API keys remain on the server.
  const response = await fetch(
    new URL('/api/draft', process.env.KEPT_BASE_URL || 'http://localhost:3000'),
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        /^https?:\/\//iu.test(input) ? { url: input } : { text: input },
      ),
      signal: AbortSignal.timeout(100_000),
    },
  );
  const result: unknown = await response.json();
  if (!response.ok) {
    const message =
      result &&
      typeof result === 'object' &&
      'error' in result &&
      typeof result.error === 'string'
        ? result.error
        : `Draft API returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  console.log(JSON.stringify(DraftResponseSchema.parse(result), null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
