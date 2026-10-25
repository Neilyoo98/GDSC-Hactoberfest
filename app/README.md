# Kept UI — P3 checkpoint

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

The seven page types render fictional, explicitly labeled fixtures from `src/components/kept/demo.ts`. No AI calls, wallet transactions, or devnet writes are simulated as successful. P2/P4 placeholders return 501 or export nothing; ops script placeholders are not operational.

P3 owns pages, components, CSS, package dependencies, and UI tests. Other lane files are initial scaffold placeholders only. Before live integration, agree hook return types with P4 and wire P2’s typed API client. Source fingerprints, evidence, challenge timers, voting, finalize, payout receipts, and rejection/error/loading flows remain integration work. Generated component-library primitives are not yet installed.

See `../docs/TEST_CHECKLIST.md` for manual checks. Original project guidance remains in the user-provided PLAN.md and CLAUDE.md.
