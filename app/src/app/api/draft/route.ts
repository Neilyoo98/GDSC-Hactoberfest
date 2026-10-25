import { NextResponse } from "next/server";
import { z } from "zod";
import type { SourceDoc } from "../../../shared/types";
import { fetchXPost } from "../../../server/context/oembed";
import { extract } from "../../../server/context/tavily";
import { sourceFromText } from "../../../server/context/source";
import { draftMarket } from "../../../server/intelligence/drafter";

export const runtime = "nodejs";

const RequestSchema = z.object({
  url: z.string().trim().url().max(2048).optional(),
  text: z.string().trim().min(1).max(20_000).optional(),
}).strict().refine((body) => Number(Boolean(body.url)) + Number(Boolean(body.text)) === 1, {
  message: "Provide exactly one of url or text.",
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  try {
    let source: SourceDoc;
    if (parsed.data.text) source = sourceFromText(parsed.data.text);
    else if (parsed.data.url) {
      const hostname = new URL(parsed.data.url).hostname.toLowerCase().replace(/^www\./u, "");
      source = hostname === "x.com" || hostname === "twitter.com"
        ? await fetchXPost(parsed.data.url)
        : await extract(parsed.data.url);
    }
    else return NextResponse.json({ error: "Provide a URL or source text." }, { status: 400 });

    return NextResponse.json(await draftMarket(source));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Drafting failed.";
    const status = /not configured/u.test(message) ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
