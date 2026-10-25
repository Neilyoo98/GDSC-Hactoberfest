# Debugging review — 2026-10-25

## Button failure

The existing Next.js development server blocked `/_next/hmr` requests originating from `127.0.0.1`. A browser reproduction rendered the create page but did not attach its click behavior. After adding the loopback addresses to `allowedDevOrigins`, fresh browser sessions processed clicks and sent `/api/draft`. The form now remains visibly disabled until hydrated, so an unready page cannot look like a working form.

## Other fixes

- Bound drafting requests to 90 seconds on the server and 100 seconds on the client; propagate cancellation. Do not retry provider auth, quota, configuration, or timeout failures.
- Distinguish source retrieval errors from AI errors. Only source retrieval failures offer the article-text fallback. Keep manually pasted source attribution without claiming the URL was fetched.
- Validate HTTP URLs and complete API responses. Return deliberately public error messages, never raw provider exceptions.
- Clear obsolete drafts when the source changes; prevent duplicate submissions and late results after cancellation.
- Align draft character limits with the form, and collapse long source text so the review form stays visible.
- Decode malformed numeric HTML entities without crashing X extraction; filter unreadable/unsafe search results; preserve URL path case during evidence deduplication.
- Repair `ai:try` to call the running API instead of importing `server-only` modules into a standalone Node script.
- Make unfinished ops commands fail explicitly instead of returning a silent successful exit.
- Update the obsolete browser test that still expected a sample-draft button.

## Validation

- Initial drafting review: TypeScript and 69 offline unit/API tests passed. URL extraction follow-up adds transport and article-reader coverage (see below).
- ESLint passed.
- Development browser suite: 17 tests passed, including a sandboxed iframe with the same flags used by VS Code Simple Browser.
- Production build and browser suite: 17 tests passed.
- Live CLI request: an explicitly fictional source was correctly rejected.
- Live browser click using [Microsoft's published 2030 pledge](https://blogs.microsoft.com/blog/2020/01/16/microsoft-will-be-carbon-negative-by-2030/): HTTP 200, accepted draft, Microsoft as promiser, deadline 2030-12-31, source hash present, no page JavaScript errors. This exercised Tavily, OpenAI, the API contract, and the actual button together.

`.env.local` was not opened or inspected. The existing application runtime used its configuration normally. Automated tests use fixture responses and make no live provider calls.

## Remaining implementation gaps and review limits

This repository is not a working end-to-end Solana app yet:

- `src/chain/*`, wallet providers, the IDL, and shared chain constants are scaffolds. Create/stake/claim buttons remain disabled.
- Resolve, relay, faucet, and health API routes still return 501. Orchestration and background-loop modules are empty. `doctor`, `keys`, `setup:devnet`, and `seed` are unfinished and now report that explicitly.
- `DEMO_MODE`, `DEMO_CACHE`, and resolver-loop behavior described in the plan are not implemented.
- The Rust program still has the placeholder program ID. Its Playground tests and live devnet money path were not executed; TypeScript/browser checks do not validate on-chain behavior.
- Before chain integration, validate UTF-8 **byte** lengths against Rust limits (the draft/form limits currently count characters), define how Kept/Broken criteria map to the program's single criteria string, and supply a source URL for text-only drafts.
- The Rust config accepts duplicate council keys and permits council/window changes while markets are open. These behaviors need explicit validation or governance rules before relying on the council path.

No claim is made that every future integration path or provider response has been tested. The checks above cover the implemented drafting/context/intelligence flow and the current preview pages.

## URL extraction follow-up

The reported EPA URL was readable over ordinary HTTPS, but the app previously depended solely on Tavily's extraction response. Articles now try a direct HTML/text reader first, using Mozilla Readability to remove page navigation and preserve paragraphs, lists, and deadlines. If that fails, Tavily is tried automatically. Its advanced-extraction timeout is explicitly 30 seconds, with a 35-second transport allowance instead of the previous premature 25-second cutoff.

Direct fetching validates public IP addresses, pins DNS for the socket, checks every redirect, bounds response/decompressed sizes and timeouts, and never executes page scripts. Tests cover both automatic readers, blocked URLs, redirects, cancellation, compressed pages, and parsing failures.

Live validation of the exact [EPA Tijuana River Watershed Public Updates URL](https://www.epa.gov/sustainable-water-infrastructure/tijuana-river-watershed-public-updates): direct reading returned 16,712 characters in 176 ms without API keys. The actual browser button then returned HTTP 200 and rendered an accepted draft attributed to EPA and SEMARNAT, with deadline 2026-12-31, a source hash, and no JavaScript errors. No manual source text was supplied. Microsoft's article also succeeded directly.

Follow-up: URL retrieval can occasionally return a readable EPA template or unrelated agency page. The extraction layer now rejects known error-page text and verifies that this EPA URL's extracted text mentions the Tijuana River before it can reach the drafter. A mismatch automatically falls through to Tavily and the independent public text reader. The browser flow again returned HTTP 200 and an accepted draft; its exact quoted sentence, “The Master Plan Scope of Work will be finalized in December 2026,” occurs verbatim in the retrieved source.

Sites requiring authentication or blocking both readers can still fail; the manual fallback remains for those cases. An extracted page can also be rejected by the drafter if it does not contain an eligible promise—source retrieval and promise acceptance are separate checks.
