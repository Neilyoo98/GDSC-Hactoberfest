import { fetchXPost } from "../src/server/context/oembed";
import { extract } from "../src/server/context/tavily";
import { sourceFromText } from "../src/server/context/source";
import { draftMarket } from "../src/server/intelligence/drafter";

async function main() {
  const input = process.argv[2];
  if (!input) throw new Error("Usage: ai:try -- <x-post-or-article-url|text>");

  let source;
  if (/^https?:\/\//iu.test(input)) {
    source = /(?:x\.com|twitter\.com)\//iu.test(input) ? await fetchXPost(input) : await extract(input);
  } else {
    source = sourceFromText(input);
  }

  const result = await draftMarket(source);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
