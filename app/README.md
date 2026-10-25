# Kept — local app

```sh
npm install
npm run dev
```

Open http://localhost:3000. Requires Node 20.19+.

```sh
npm run check
npm run build
npx playwright install chromium
npm run test:e2e
```

The `/create` page uses the real `/api/draft` endpoint with OpenAI, X oEmbed, and Tavily. The other pages render explicitly labeled fixtures from `src/components/kept/demo.ts`. Wallet transactions and devnet writes are not implemented. Other P2/P4 API placeholders return 501, chain files export nothing, and unfinished ops commands exit with an explanatory error.

The app runtime needs `OPENAI_API_KEY` for drafts. Article URLs first use a direct page reader with Mozilla Readability; when a page cannot be read directly, the app automatically tries Tavily using `TAVILY_API_KEY`. Ordinary readable HTML pages do not require Tavily. Only when both automatic methods fail does the form offer pasted text. API keys are server-only. Never print or commit them. Start the app before running the CLI draft check:

```sh
npm run ai:try -- 'https://blogs.microsoft.com/blog/2020/01/16/microsoft-will-be-carbon-negative-by-2030/'
npm run ai:try -- 'https://www.epa.gov/sustainable-water-infrastructure/tijuana-river-watershed-public-updates'
```

The CLI calls the running server; it does not load environment files. `KEPT_BASE_URL` overrides its default `http://localhost:3000`.

In VS Code, use **Simple Browser: Show** and enter `http://127.0.0.1:3000/create`. Local loopback addresses are allowed by `next.config.ts`. After a server restart, reload the preview. A ready form displays **Generate AI draft**; while JavaScript loads it displays **Loading form…**.

`npm run check` runs TypeScript plus offline unit/API tests. `npm run test:e2e` builds and tests a production server on port 3100. To test a running development server instead:

```sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e
```

Automated tests use fixture provider responses and spend no API credits. The actual resolver workflow, relay, faucet, wallets, and chain client remain integration work. See `../docs/archive/DEBUG_REVIEW.md` for the review findings and validation limits.

See `../docs/TEST_CHECKLIST.md` for manual checks. Original project guidance remains in `../docs/PLAN.md` and `../CLAUDE.md`.
