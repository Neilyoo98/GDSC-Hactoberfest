# Kept: Build Plan
### Hacktoberfest 2026 (GDSC x MLH) · UMD · Build window **12:00–18:00** (6 hours) · Team of 4

> Did they keep their promise? A public promise tracker on Solana.
> **Tracks:** Solana Partner Challenge + Tech for Good. Confirm the exact judging criteria at kickoff.

`CLAUDE.md` holds the **fixed decisions, business rules and role summaries**. This file holds **who builds what, in which file, by when, and what to do when something breaks.** The two are kept in sync; see [§15](#15-relationship-to-claudemd).

---

## Contents

0. [The 6-hour reality check](#0-the-6-hour-reality-check)
1. [The demo (what judges see)](#1-the-demo-what-judges-see)
2. [Team and work separation](#2-team-and-work-separation)
3. [Architecture: the five layers](#3-architecture-the-five-layers)
4. [Repo structure and file ownership](#4-repo-structure-and-file-ownership)
5. [Contracts (lock by 12:30)](#5-contracts-lock-by-1230)
6. [P1: Blockchain (Anchor program + program tests)](#6-p1-blockchain-anchor-program--program-tests)
7. [P2: Backend (AI, server workflows, scripts, backend tests)](#7-p2-backend-ai-server-workflows-scripts-backend-tests)
8. [P3: Frontend UI (pages, design, UI tests)](#8-p3-frontend-ui-pages-design-ui-tests)
9. [P4: Frontend wallet + chain (client, Blinks, smoke test)](#9-p4-frontend-wallet--chain-client-blinks-smoke-test)
10. [Timeline and checkpoints](#10-timeline-and-checkpoints)
11. [Git workflow: branch, commit, check](#11-git-workflow-branch-commit-check)
12. [Tools, accounts and setup](#12-tools-accounts-and-setup)
13. [Fallbacks (if X breaks, do Y)](#13-fallbacks-if-x-breaks-do-y)
14. [Pitch and judge Q&A](#14-pitch-and-judge-qa)
15. [Relationship to CLAUDE.md](#15-relationship-to-claudemd)

---

## 0. The 6-hour reality check

The outline is a 10-hour scope, and nobody on the team has built with Anchor before. Three decisions follow from that:

| Decision | Why |
|---|---|
| **Program is built in Solana Playground** (browser IDE at `beta.solpg.io`), not a local Anchor toolchain | No Rust, Solana CLI or WSL install on anyone's machine. Build, deploy, test and IDL export all happen in the browser. |
| **Every lane starts on mocks** and switches to real data at 14:00 | Nobody waits on anybody. The UI renders from fixtures by 13:00, and the AI runs from a CLI script before the UI exists. |
| **Two go/no-go gates for the program** (12:45 and 14:00) with a ready-made fallback | If Anchor stalls, we switch to the custodial fallback ([§13](#13-fallbacks-if-x-breaks-do-y)) without rewriting the UI, because the UI only talks to the `KeptChain` interface. |

### Scope tiers

| Tier | Features | Rule |
|---|---|---|
| **MUST: never cut** | Paste X link → AI draft → edit → create on-chain · faucet · stake Kept/Broken · live odds · AI resolve with sources · 30 s window · finalize · claim with correct payout | Must work end to end by **15:30** |
| **SHOULD** | Gasless (server pays fees) · challenge with 10 tUSDC bond · 3-person council vote · promiser record page | Built 15:30–16:45 |
| **COULD** | Blinks (via tunnel and dial.to) · forecaster leaderboard · news search input · background resolver loop | Only if the 15:30 checkpoint passed |

**Cut order when behind:** news search → leaderboard → Blinks → gasless (pre-fund wallets with devnet SOL instead) → council (keep the challenge button and route it to the council page anyway). Never cut the MUST row.

---

## 1. The demo (what judges see)

About 3 minutes, all live on devnet. Seeded state is prepared at 16:45 ([§10](#10-timeline-and-checkpoints)).

| # | Scene | What happens on screen | Layer shown | ~Time |
|---|---|---|---|---|
| 1 | **The problem** | Home page: a grid of promises ("Route 1 repaved by spring", "Net zero by 2030") with odds bars, and a promiser card reading *Kept 2 · Broken 1 · Pending 3*. | Experience | 15s |
| 2 | **Paste a promise** | Paste a real public X post link → the source card appears with the post text and a **fingerprint** (sha256) → Claude's draft fills in: who, exact promise, deadline, Kept/Broken criteria. Then paste a vague post → **rejected with a reason**. | Context → Intelligence | 40s |
| 3 | **Create** | Edit the deadline → Create → Phantom approves → "Saved on Solana" with an Explorer link. The user paid **0 SOL**. | Orchestration → Settlement | 20s |
| 4 | **Predict** | Wallet A stakes 10 on Broken, wallet B stakes 75 on Kept (two browser windows). The odds bar moves live. *(COULD: open the Blink on dial.to and stake from there.)* | Settlement | 30s |
| 5 | **AI resolves** | Open a seeded market whose deadline has passed → "Run resolution" → a research trace streams in (queries, sources found, verdict, confidence 0.86) → proposal is written on-chain → a 30 s challenge ring starts. | Context → Intelligence → Orchestration | 35s |
| 6 | **Challenge → council** | On a second market, wallet A challenges (10 tUSDC bond). Two council wallets vote. The result settles. | Settlement | 25s |
| 7 | **Claim + record** | The winner claims: **10 × 100 ÷ 25 = 40 tUSDC**, shown as a payout receipt. The promiser record updates to *Broken +1*. | Settlement → Experience | 15s |

**Spend the most rehearsal time on scenes 2, 5 and 7.** The AI turning a messy post into a checkable question, the visible sources, and money moving by program rules are the three things nobody else will have.

---

## 2. Team and work separation

Four lanes. Every file has **one** owner, and **each lane writes the tests for its own code.**

| Lane | Person | Area | One-line job |
|---|---|---|---|
| **P1** | ________ | **Blockchain** | The Anchor program, its tests, and the IDL + program ID handoff |
| **P2** | ________ | **Backend** | All server code: AI drafting and resolving, fee-payer relay, faucet, devnet scripts, backend + API tests |
| **P3** | ________ | **Frontend: UI** | Design system, every page and component, UI end-to-end tests |
| **P4** | ________ | **Frontend: wallet + chain** | Wallet connect, the chain client every page uses (incl. mock), Blinks, devnet smoke test, README |

### 2.1 Who owns what

**owns** = writes and maintains it · *uses* = imports it, never edits it · – = not involved

| Work | P1 Blockchain | P2 Backend | P3 Frontend: UI | P4 Frontend: wallet + chain |
|---|---|---|---|---|
| **BLOCKCHAIN** | | | | |
| Solana program `program/` | **owns** | reviews | – | – |
| IDL + constants `src/shared/idl/`, `src/shared/constants.ts` | **owns** | *uses* | *uses* | *uses* |
| Custodial fallback `src/chain/custodial.ts` (only if Anchor is a no-go) | **owns** | – | – | reviews |
| **BACKEND** | | | | |
| API + domain types `src/shared/types.ts`, `src/shared/apiClient.ts` | – | **owns** | *uses* | *uses* |
| Context layer `src/server/context/` (oEmbed, Tavily, hashing) | – | **owns** | – | – |
| Intelligence layer `src/server/intelligence/` (Claude drafter + resolver) | – | **owns** | – | – |
| Orchestration `src/server/orchestrator/` (resolve, relay, faucet, loop) | – | **owns** | – | – |
| API routes `src/app/api/{draft,resolve,relay,faucet,health}/` | – | **owns** | – | – |
| Ops scripts `scripts/{keys,doctor,setup-devnet,seed,ai-try}.ts` | helps | **owns** | – | – |
| `.env.example`, `instrumentation.ts` | – | **owns** | – | – |
| **FRONTEND** | | | | |
| `package.json`, `layout.tsx`, `globals.css`, design tokens | – | – | **owns** | *uses* |
| Components `src/components/` | – | – | **owns** | – |
| Every page `src/app/**/page.tsx` | – | – | **owns** | – |
| Wallet `src/wallet/` (Providers, burner wallet) | – | – | *uses* | **owns** |
| Chain client `src/chain/` (interface, mock, Anchor impl, tx builders, hooks) | helps (PDAs) | *uses* `tx.ts` | *uses* hooks | **owns** |
| Blinks `src/app/api/actions/`, `src/app/actions.json/` + cloudflared tunnel | – | – | – | **owns** |
| **TESTING** | | | | |
| Program tests `program/tests/kept.test.ts` | **owns** | – | – | – |
| Backend unit tests `src/server/**/*.test.ts` | – | **owns** | – | – |
| API contract tests `tests/api/*.test.ts` | – | **owns** | – | – |
| UI end-to-end tests `tests/e2e/*.spec.ts` + `docs/TEST_CHECKLIST.md` | – | – | **owns** | – |
| Chain client unit tests `src/chain/*.test.ts` | – | – | – | **owns** |
| Devnet smoke test `scripts/smoke-devnet.ts` + `scripts/demo-reset.ts` | – | – | – | **owns** |
| **DOCS** | | | | |
| `program/README.md` | **owns** | – | – | – |
| `README.md`, `docs/RUNBOOK.md` | – | – | – | **owns** |

### 2.2 Test scripts

| What it proves | File(s) | Owner | Runner | Command | Green by |
|---|---|---|---|---|---|
| Every instruction: happy path + one failure; payout worked example (10 × 100 ÷ 25 = 40) | `program/tests/kept.test.ts` | P1 | Playground **Test** tab | run in Playground | CP1 (core), CP2 (challenge + council) |
| oEmbed HTML → plain text; same text → same hash | `src/server/context/*.test.ts` | P2 | vitest | `npm test` | CP1 |
| Drafter rejects vague / private person / harm; foreign citations dropped; confidence 0.65 → council | `src/server/intelligence/*.test.ts` (recorded Claude responses, no live calls) | P2 | vitest | `npm test` | CP2 |
| Relay refuses wrong fee payer, SystemProgram transfer, unknown program | `src/server/orchestrator/relay.test.ts` | P2 | vitest | `npm test` | CP2 |
| Every `/api/*` returns the `types.ts` shape; bad input → 400 | `tests/api/*.test.ts` | P2 | vitest against `npm run dev` | `npm run test:api` | CP2 |
| Payout mirror: 40; void refund; nobody on the winning side → refund | `src/chain/payout.test.ts` | P4 | vitest | `npm test` | CP1 |
| Account decoding: base units ÷ 1e6, enums → strings, default pubkey → `null` | `src/chain/read.test.ts` | P4 | vitest | `npm test` | CP2 |
| Real devnet: faucet → create → 3 stakes → propose → wait → finalize → claim = +40 | `scripts/smoke-devnet.ts` | P4 | tsx | `npm run smoke:devnet` | **CP2 (this is the gate)** |
| UI in mock mode: create (accept + reject), stake, every resolution state, claim | `tests/e2e/*.spec.ts` | P3 | Playwright + burner wallet | `npm run test:e2e` | CP3 |
| Env, keys, RPC, SOL balances, Claude + Tavily reachable | `scripts/doctor.ts` | P2 | tsx | `npm run doctor` | CP0 |
| Wallet states, wrong network, stake 1 and 100, 101 rejected, projector size, dark mode | `docs/TEST_CHECKLIST.md` | P3 | a person | — | CP3 |

`npm run check` (`tsc --noEmit && vitest run`) runs every unit test and must pass before **every** merge. At each checkpoint, P4 runs `smoke:devnet`, P2 runs `test:api`, P3 runs `test:e2e`, and each posts the result in chat.

### 2.3 Handoffs (who is waiting on whom)

| By | From → To | What |
|---|---|---|
| 12:25 | P3 → all | Scaffold on `main` (every file stubbed, all dependencies installed) |
| 12:30 | P2 → all | `types.ts`, `apiClient.ts`, `.env.local` (by private DM) |
| 12:30 | P4 → all | `src/chain/index.ts` interface + hook signatures |
| 12:45 | P1 → P2, P4 | Program ID + stub IDL |
| 12:45 | P4 → P3 | `mock.ts` + `fixtures.ts` (every market status covered) |
| 13:30 | P1 → all | **Frozen** IDL (account layout locked) |
| 14:15 | P4 → P2 | `buildProposeTx` + tx builders working on devnet |
| 14:30 | P2 → P4 | `/api/relay` + `/api/faucet` live |
| 15:30 | P4 → all | `npm run smoke:devnet` green = **CP2 passed** |

**Review pairs:** P1 ↔ P2, P3 ↔ P4. Reviews take 2 minutes: does `npm run check` pass, and does the PR stay inside the author's folders?

**Council wallets for the demo:** P1, P2 and P3 each create a **second** Phantom account named `Kept Council N`. Their public keys go into the config at setup.

---

## 3. Architecture: the five layers

```
┌──────────────────────────── EXPERIENCE ─────────────────────────────────────────────────────────────┐
│  P3: Next.js pages · design system · UI states       P4: Phantom/burner wallet · Blinks (dial.to / X) │
└───────────────▲──────────────────────────────────────────────────────────────▲──────────────────────┘
                │ React hooks  (src/chain/hooks.ts, P4)                        │ typed fetch (src/shared/apiClient.ts, P2)
┌───────────────┴──────────────────────────── ORCHESTRATION ───────────────────┴──────────────────────┐
│  P2: /api/draft · /api/resolve/[id] · /api/relay · /api/faucet · resolver loop (instrumentation.ts)  │
│  P4: /api/actions/stake (Blinks) · client tx builder → relay                                          │
│  Workflows A–D as explicit state machines. The ONLY layer that holds keys or combines layers.        │
└──────────▲───────────────────────────────▲─────────────────────────────────────▲─────────────────────┘
           │                               │                                     │
┌──────────┴───── CONTEXT (P2) ─────┐ ┌────┴──── INTELLIGENCE (P2) ──────┐ ┌───────┴──── SETTLEMENT (P1) ────┐
│ X oEmbed → SourceDoc              │ │ Claude drafter  → DraftResult    │ │ Anchor program (devnet)         │
│ Tavily search/extract → Evidence  │→│ Claude resolver → Verdict        │ │ Config · Market · Vault · Position│
│ sha256 fingerprints               │ │ zod schemas · guardrails         │ │ tUSDC SPL mint (6 decimals)     │
│ chain reads (markets, positions)  │ │ confidence gate ≥ 0.7            │ │ the ONLY thing that moves money │
└───────────────────────────────────┘ └──────────────────────────────────┘ └─────────────────────────────────┘
   CONTRACT LAYER, the seams between lanes:
   src/shared/types.ts (P2) · src/shared/constants.ts + idl/ (P1) · src/chain/index.ts KeptChain interface (P4)
```

### Layer rules (these are what keep merges clean and testing easy)

| Layer | Can call | Must never | Testable how |
|---|---|---|---|
| **Context** | HTTP (oEmbed, Tavily), RPC reads | Call Claude, sign anything | Unit tests with recorded HTTP fixtures |
| **Intelligence** | Claude only | Fetch URLs, touch the chain, read env keys other than `ANTHROPIC_API_KEY` | **Pure function:** `(SourceDoc) → DraftResult`, `(Market, EvidencePack) → Verdict`. Test with fixture inputs. |
| **Orchestration** | Context, Intelligence, `src/chain/tx.ts` builders, server keys | Contain prompt text or account layouts | `curl` the routes; dry-run flag skips the on-chain send |
| **Settlement** | Nothing off-chain | Trust anything not signed: the resolver key, council keys and users are checked on-chain | Playground mocha tests |
| **Experience** | Hooks + `apiClient` only | Import from `src/server/**` or hold secrets | Mock mode (`NEXT_PUBLIC_CHAIN=mock`) |

### Workflow state machine (one market's life)

```
            create_market                    deadline passes
  (draft) ───────────────► OPEN ─────────────────────────────► [resolver: gather → judge → validate]
                            │  place_stake (1–100, once)                     │
                            │                                                │
               verdict ∈ {kept, broken} AND confidence ≥ 0.7     unclear OR confidence < 0.7
                            ▼                                                ▼
                        PROPOSED ── challenge (10 bond, within window) ──► CHALLENGED      COUNCIL
                            │                                                │                │
                 window ends, no challenge                     2 of 3 matching votes (Kept / Broken / Void)
                   (anyone: finalize)                                        │                │
                            ▼                                                ▼                ▼
                        FINALIZED ◄──────────────────────────────── FINALIZED or VOID ◄───────┘
                            │
                     claim (winners; Void = refund; challenger bond back if council changed result)
```

### Workflow → layer → owner map

| Workflow | Context | Intelligence | Orchestration | Settlement | Experience |
|---|---|---|---|---|---|
| **A: Create** | `oembed.ts`, `tavily.extract`, `hash.ts` (P2) | `drafter.ts` (P2) | `/api/draft` (P2), `createMarket` tx + relay (P4) | `create_market` (P1) | `/create` page (P3) |
| **B: Predict** | `listMarkets` reads (P4) | none | `/api/faucet`, `/api/relay` (P2), `stake` tx (P4), Blink route (P4) | `place_stake` (P1) | market page stake panel (P3) |
| **C: Resolve** | `evidence.ts` (P2) | `resolver.ts` (P2) | `/api/resolve/[id]` + loop (P2), `buildProposeTx` (P4) | `propose_outcome`, `challenge`, `council_vote`, `finalize` (P1) | resolution card, council page (P3) |
| **D: Claim + score** | positions reads (P4) | none | `claim` tx (P4) | `claim` (P1) | payout receipt, promiser page, leaderboard (P3) |

---

## 4. Repo structure and file ownership

**One Next.js app plus the program.** Server routes, the resolver and the UI share one `package.json`, one `tsconfig` and one set of types, and only one port needs a tunnel for Blinks. Conflicts are prevented by folder ownership and by a **scaffold commit that creates every file below as a stub**, so nobody creates the same file at the same time.

Legend: **[BC]** blockchain · **[BE]** backend · **[FE]** frontend · **[TEST]** tests · **[DOC]** docs

```
GDSC-Hactoberfest/
├── CLAUDE.md                                   team   rules + roles, loaded by Claude Code
├── PLAN.md                                     team   this file
├── README.md                          [DOC]    P4     written at 16:45
├── docs/
│   ├── TEST_CHECKLIST.md              [TEST]   P3     manual UI checks before each checkpoint
│   └── RUNBOOK.md                     [DOC]    P4     setup, wallet funding, start, tunnel, demo reset
├── program/                           [BC]     P1     copy of the Playground project, committed at each milestone
│   ├── src/lib.rs
│   ├── tests/kept.test.ts             [TEST]   P1
│   └── README.md                               P1     open, build, deploy and export the IDL in Playground
└── app/                                               Next.js (App Router, TypeScript, Tailwind, shadcn/ui)
    ├── package.json                   [FE]     P3     ALL deps installed in the scaffold; others ask P3
    ├── playwright.config.ts           [TEST]   P3
    ├── .env.example                   [BE]     P2     every variable, no values
    ├── instrumentation.ts             [BE]     P2     starts the resolver loop when RESOLVER_LOOP=1
    ├── scripts/
    │   ├── keys.ts                    [BE]     P2     generate fee-payer and resolver keypairs
    │   ├── doctor.ts                  [BE]     P2     env, RPC, SOL balances, Claude, Tavily → ✅/❌ table
    │   ├── setup-devnet.ts            [BE]     P2     tUSDC mint, initialize_config, fund demo wallets
    │   ├── seed.ts                    [BE]     P2     demo markets (one past its deadline at demo time)
    │   ├── ai-try.ts                  [BE]     P2     `npm run ai:try -- <url>` runs context + AI in the terminal
    │   ├── smoke-devnet.ts            [TEST]   P4     full money path on real devnet, asserts +40
    │   └── demo-reset.ts              [TEST]   P4     re-seed + re-fund demo wallets before rehearsal
    ├── tests/
    │   ├── api/*.test.ts              [TEST]   P2     contract tests against the running dev server
    │   └── e2e/*.spec.ts              [TEST]   P3     Playwright, mock mode, burner wallet
    └── src/
        ├── shared/                                    CONTRACT LAYER
        │   ├── types.ts               [BE]     P2     domain + API types (§5.1)
        │   ├── apiClient.ts           [BE]     P2     typed fetch wrappers for /api/*
        │   ├── constants.ts           [BC]     P1     program id, mint, seeds, limits (§5.3)
        │   └── idl/kept.json, kept.ts [BC]     P1     exported from Playground
        ├── server/                    [BE]     P2     server-only (`import "server-only"`)
        │   ├── context/                               oembed.ts · tavily.ts · hash.ts · evidence.ts (+ *.test.ts)
        │   ├── intelligence/                          claude.ts · schemas.ts · prompts.ts · drafter.ts · resolver.ts (+ *.test.ts)
        │   ├── orchestrator/                          resolveMarket.ts · loop.ts · relay.ts · faucet.ts · keys.ts · trace.ts (+ relay.test.ts)
        │   └── fixtures/                              cached drafts, evidence, verdicts, recorded Claude responses
        ├── chain/                     [FE]     P4     isomorphic chain client
        │   ├── index.ts                        P4     KeptChain interface + factory (mock | anchor | custodial)
        │   ├── anchor.ts                       P4     real implementation from the IDL
        │   ├── pdas.ts · tx.ts · read.ts       P4     PDA derivation, tx builders (incl. buildProposeTx), decoding
        │   ├── payout.ts (+ .test.ts)          P4     TS mirror of on-chain payout math
        │   ├── read.test.ts           [TEST]   P4
        │   ├── hooks.ts                        P4     useMarkets, useMarket, usePositions, useKeptActions
        │   ├── mock.ts, fixtures.ts   [TEST]   P4     in-memory implementation (ready by 12:45)
        │   └── custodial.ts           [BC]     P1     FALLBACK only, if Anchor is a no-go
        ├── wallet/                    [FE]     P4     Providers.tsx (wallet adapter + Sonner), burner.ts
        ├── components/
        │   ├── ui/                    [FE]     P3     shadcn generated
        │   ├── kept/                  [FE]     P3     MarketCard, OddsBar, StatusChip, Countdown, PromiseQuote,
        │   │                                          SourceFingerprint, StakePanel, ResolutionCard, EvidenceList,
        │   │                                          ResearchTrace, MarketTimeline, PayoutReceipt, PromiserScore
        │   └── flows/                 [FE]     P3     SourceCard, DraftForm, RejectNotice, ChallengePanel, CouncilVotePanel
        └── app/
            ├── layout.tsx, globals.css [FE]    P3     wraps children in P4's <Providers/> (done in the scaffold)
            ├── page.tsx                [FE]    P3     home: market grid
            ├── markets/[id]/page.tsx   [FE]    P3
            ├── promisers/[handle]/page.tsx [FE] P3
            ├── leaderboard/page.tsx    [FE]    P3
            ├── faucet/page.tsx         [FE]    P3
            ├── create/page.tsx         [FE]    P3
            ├── council/page.tsx        [FE]    P3
            ├── actions.json/route.ts   [FE]    P4     Blinks discovery
            └── api/                    [BE]    P2
                ├── draft/route.ts
                ├── resolve/[id]/route.ts              POST runs resolution, GET returns the research trace
                ├── relay/route.ts
                ├── faucet/route.ts
                ├── health/route.ts
                └── actions/stake/route.ts  [FE] P4    Blinks GET (metadata) + POST (tx)
```

### Ownership rules

1. **Only the owner edits a file.** If you need a change in someone else's file, say so in team chat, or leave `// TODO(P3): …` in your own file and keep going.
2. **Hot files have exactly one owner:** `package.json` (P3), `types.ts` (P2), `constants.ts` + `idl/` (P1), `layout.tsx` (P3), `.env.example` (P2), `src/chain/index.ts` (P4).
3. **Cross-lane mount points are created once, in the scaffold:** `layout.tsx` (P3) already wraps P4's `<Providers>`, and pages already import P4's hooks from `src/chain/hooks.ts`. Neither side touches the other's file after that.
4. **No moving, renaming or reformatting** other people's files. Prettier config is committed in the scaffold, so everyone formats the same way.
5. **Contracts change only additively** after 12:30: add optional fields, never rename or remove. Announce every change in chat.
6. **`.env.local` is never committed.** P2 sends it in a private team DM.

---

## 5. Contracts (lock by 12:30)

### 5.1 Domain + API types: `src/shared/types.ts` (P2)

```ts
export type Side = "kept" | "broken";
export type Verdict = Side | "unclear";
export type Outcome = Side | "void";
export type MarketStatus = "open" | "proposed" | "challenged" | "council" | "finalized" | "void";

export interface MarketView {
  id: number;                       // u64 from config.market_count
  pubkey: string;
  creator: string;
  promiser: string;                 // "@handle" or organization name (≤ 40 chars)
  promiseText: string;              // exact quote (≤ 240 chars)
  criteria: string;                 // "Kept if … Broken if … Source: …" (≤ 160 chars)
  sourceUrl: string;                // ≤ 120 chars
  sourceHash: string;               // hex sha256 of the fetched source text
  deadline: number;                 // unix seconds
  totals: { kept: number; broken: number };   // tUSDC, UI units (not base units)
  status: MarketStatus;
  proposal: null | {
    verdict: Verdict; confidence: number; summary: string; sources: string[];
    proposedAt: number; windowEndsAt: number;
  };
  challenger: string | null;
  votes: (Outcome | null)[];        // length 3, index = council seat
  final: Outcome | null;
  forfeitedBonds: number;
}

export interface PositionView { market: number; owner: string; side: Side; amount: number; claimed: boolean; }

// ---- Context layer ----
export interface SourceDoc {
  kind: "x_post" | "article" | "text";
  url: string | null;
  author: string | null;            // oEmbed author_name / article site
  authorUrl: string | null;
  text: string;                     // plain text, tags stripped
  publishedAt: string | null;       // ISO, if known
  sha256: string;                   // hex, of `text`
}
export interface EvidenceItem { url: string; title: string; snippet: string; publishedAt: string | null; }
export interface EvidencePack { queries: string[]; items: EvidenceItem[]; sha256: string; }

// ---- Intelligence layer ----
export type RejectReason = "vague" | "no_deadline" | "private_person" | "death_or_harm" | "not_a_promise" | "past_deadline";
export interface MarketDraft {
  promiser: string; promiserType: "person" | "organization";
  promiseText: string;              // exact words from the source
  question: string;                 // "Will … by …?"
  deadline: string;                 // ISO date
  criteriaKept: string; criteriaBroken: string; checkSource: string;
  assumptions: string[];            // e.g. "‘spring’ read as June 20, 2027"
}
export interface DraftResponse {
  decision: "accept" | "reject";
  rejectReason: RejectReason | null;
  explanation: string;              // shown to the user either way
  draft: MarketDraft | null;
  source: SourceDoc;
}
export interface Citation { url: string; title: string; quote: string; }
export interface ResolveResponse {
  marketId: number;
  verdict: Verdict; confidence: number; summary: string; citations: Citation[];
  action: "proposed" | "sent_to_council" | "skipped";
  txSig: string | null;
  trace: TraceStep[];
}
export interface TraceStep { at: number; step: "read" | "search" | "judge" | "validate" | "write"; detail: string; }

// ---- Orchestration endpoints ----
export interface DraftRequest  { url?: string; text?: string; }                     // POST /api/draft
export interface RelayRequest  { tx: string; }                                      // base64, user-signed → { signature }
export interface FaucetRequest { wallet: string; }                                  // → { signature, amount } | { error }
```

### 5.2 HTTP endpoints

| Method + path | Owner | Body → Response | Notes |
|---|---|---|---|
| `POST /api/draft` | P2 | `DraftRequest` → `DraftResponse` | `url` = X post or article; `text` = manual paste fallback |
| `POST /api/resolve/[id]` | P2 | `{ dryRun?: boolean }` → `ResolveResponse` | Demo button calls this; the loop calls the same function |
| `GET /api/resolve/[id]` | P2 | → `{ trace: TraceStep[], citations }` | In-memory only (non-authoritative; the chain has the summary + sources) |
| `POST /api/relay` | P2 | `RelayRequest` → `{ signature }` | Validates, co-signs as fee payer, sends |
| `POST /api/faucet` | P2 | `FaucetRequest` → `{ signature, amount: 100 }` | Creates the ATA (fee payer pays rent) + mints 100 tUSDC. "Once" = refuse if the ATA already exists |
| `GET /api/health` | P2 | → `{ rpc, claude, tavily, feePayerSol, programId }` | Used by `doctor.ts` |
| `GET/POST /api/actions/stake?market=&side=&amount=` | P4 | Solana Actions spec | Blinks |
| `GET /actions.json` | P4 | Actions rules | Blinks discovery |

### 5.3 Constants: `src/shared/constants.ts` (P1)

```ts
export const PROGRAM_ID = process.env.NEXT_PUBLIC_PROGRAM_ID!;   // also inside the IDL `address`
export const TUSDC_MINT = process.env.NEXT_PUBLIC_TUSDC_MINT!;
export const TUSDC_DECIMALS = 6;
export const MIN_STAKE = 1, MAX_STAKE = 100, BOND = 10;          // UI units
export const SEEDS = { config: "config", market: "market", vault: "vault", position: "position" } as const;
export const LIMITS = { promiser: 40, promiseText: 240, criteria: 160, sourceUrl: 120, summary: 280, sources: 3, sourceLen: 120 } as const;
export const CONFIDENCE_GATE = 0.7;
```

> **Why the text limits are so tight:** a Solana transaction is at most **1232 bytes**. `create_market` carries the promise, criteria, URL and hash, plus about 8 accounts and 2 signatures. These caps keep it around 1,050 bytes. Drafts are trimmed to `LIMITS` in the UI before signing.

### 5.4 Chain client interface: `src/chain/index.ts` (P4)

```ts
export interface KeptChain {
  listMarkets(): Promise<MarketView[]>;
  getMarket(id: number): Promise<MarketView | null>;
  listPositions(f?: { owner?: string; market?: number }): Promise<PositionView[]>;
  createMarket(w: WalletLike, d: MarketDraft & { sourceUrl: string; sourceHash: string }): Promise<{ sig: string; id: number }>;
  stake(w: WalletLike, id: number, side: Side, amount: number): Promise<string>;
  challenge(w: WalletLike, id: number): Promise<string>;
  councilVote(w: WalletLike, id: number, outcome: Outcome): Promise<string>;
  finalize(w: WalletLike, id: number): Promise<string>;
  claim(w: WalletLike, id: number): Promise<string>;
}
export function getChain(): KeptChain;   // switches on NEXT_PUBLIC_CHAIN = "mock" | "anchor" | "custodial"

// server-only builder used by P2's orchestrator
export function buildProposeTx(resolver: PublicKey, id: number, v: Verdict, confidenceBps: number,
                               summary: string, sources: string[], evidenceHash: Uint8Array): Promise<Transaction>;
```

**Hooks (P4) that P3 uses:** `useMarkets()`, `useMarket(id)`, `usePositions({ owner })`, `useKeptActions()` → `{ createMarket, stake, challenge, councilVote, finalize, claim, faucet }`. Each action shows Sonner toasts: *Waiting for wallet → Sending → Confirmed ↗ Explorer*, or the error.

---

## 6. P1: Blockchain (Anchor program + program tests)

**Goal:** One Anchor program on devnet that holds every market's money and enforces every rule in `CLAUDE.md`. No admin withdraw.

### Files
```
Solana Playground project "kept"  →  copied to program/src/lib.rs + program/tests/kept.test.ts
app/src/shared/idl/kept.json · kept.ts · constants.ts
```

### Accounts

| Account | Seeds | Fields |
|---|---|---|
| `Config` | `["config", admin]` | admin, resolver, council `[Pubkey; 3]`, mint, challenge_window (s), bond, market_count, bump |
| `Market` | `["market", config, id.to_le_bytes()]` | see struct below (final version: `program/src/lib.rs`) |
| Vault (SPL token account) | `["vault", market]`, authority = market PDA | holds every stake and bond for that market |
| `Position` | `["position", market, user]` | owner, side, amount, claimed, bump |

```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("11111111111111111111111111111111"); // Playground replaces this on first build

pub const MIN_STAKE: u64 = 1_000_000;    // 1 tUSDC (6 decimals)
pub const MAX_STAKE: u64 = 100_000_000;  // 100 tUSDC
pub const GATE_BPS: u16 = 7_000;         // 0.70 confidence

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Status { Open, Proposed, Challenged, Council, Finalized, Void }

// 0 = none, 1 = kept, 2 = broken, 3 = void/unclear. Plain u8 keeps vote counting simple.
#[account]
#[derive(InitSpace)]
pub struct Market {
    pub id: u64,
    pub creator: Pubkey,
    #[max_len(40)]  pub promiser: String,
    #[max_len(240)] pub promise_text: String,
    #[max_len(160)] pub criteria: String,
    #[max_len(120)] pub source_url: String,
    pub source_hash: [u8; 32],
    pub deadline: i64,
    pub total_kept: u64,
    pub total_broken: u64,
    pub status: Status,
    pub proposed: u8,
    pub confidence_bps: u16,
    #[max_len(280)] pub summary: String,
    #[max_len(3, 120)] pub sources: Vec<String>,
    pub evidence_hash: [u8; 32],
    pub proposed_at: i64,
    pub challenger: Pubkey,          // Pubkey::default() = none
    pub votes: [u8; 3],
    pub final_outcome: u8,
    pub forfeited_bonds: u64,
    pub bond_refund_due: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position { pub owner: Pubkey, pub side: u8, pub amount: u64, pub claimed: bool, pub bump: u8 }
```

### Instructions

Every instruction that creates an account takes **two signers**: `user` (Phantom) and `payer` (the server fee payer, `mut`). Rent and fees come from `payer`, so users never need SOL.

| # | Instruction | Signer(s) | Checks | Effect |
|---|---|---|---|---|
| 1 | `initialize_config(resolver, council, window, bond)` | admin | once | creates `Config` |
| 2 | `update_config(resolver, council, window)` | admin | `admin == config.admin` | switch 30 s ↔ 24 h; swap council keys |
| 3 | `create_market(promiser, text, criteria, url, hash, deadline)` | user + payer | deadline > now, string lengths | `Market` + vault, `market_count += 1` |
| 4 | `place_stake(side, amount)` | user + payer | status Open, now < deadline, MIN ≤ amount ≤ MAX, `Position` is `init` so **one stake per person per market** | transfer user → vault, add to totals |
| 5 | `propose_outcome(verdict, confidence_bps, summary, sources, evidence_hash)` | resolver | `signer == config.resolver`, status Open, now ≥ deadline | kept/broken with bps ≥ 7000 → Proposed; otherwise → Council |
| 6 | `challenge()` | user (+ payer) | has a Position, status Proposed, now < proposed_at + window | bond user → vault, status Challenged, record challenger |
| 7 | `council_vote(outcome)` | council member | signer ∈ council, status Challenged/Council, seat hasn't voted | record vote; at 2 matching votes → Finalized/Void; set `bond_refund_due` if result ≠ proposed, else `forfeited_bonds += bond` |
| 8 | `finalize()` | anyone | status Proposed, now ≥ proposed_at + window | final = proposed, Finalized |
| 9 | `claim()` | user | status Finalized/Void, `!position.claimed` | payout below + bond if `user == challenger && bond_refund_due`; vault → user, market PDA signs |

**Pattern: `place_stake` written out in full** (copy this shape for the others):

```rust
pub fn place_stake(ctx: Context<PlaceStake>, side: u8, amount: u64) -> Result<()> {
    let m = &mut ctx.accounts.market;
    require!(m.status == Status::Open, KeptError::NotOpen);
    require!(Clock::get()?.unix_timestamp < m.deadline, KeptError::PastDeadline);
    require!((MIN_STAKE..=MAX_STAKE).contains(&amount), KeptError::StakeOutOfRange);
    require!(side == 1 || side == 2, KeptError::BadSide);

    token::transfer(CpiContext::new(ctx.accounts.token_program.to_account_info(), Transfer {
        from: ctx.accounts.user_token.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    }), amount)?;

    if side == 1 { m.total_kept += amount } else { m.total_broken += amount }
    let p = &mut ctx.accounts.position;
    p.owner = ctx.accounts.user.key(); p.side = side; p.amount = amount; p.claimed = false;
    p.bump = ctx.bumps.position;
    Ok(())
}

#[derive(Accounts)]
pub struct PlaceStake<'info> {
    #[account(mut)] pub user: Signer<'info>,
    #[account(mut)] pub payer: Signer<'info>,
    #[account(seeds = [b"config"], bump = config.bump)] pub config: Account<'info, Config>,
    #[account(mut, seeds = [b"market", market.id.to_le_bytes().as_ref()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(init, payer = payer, space = 8 + Position::INIT_SPACE,
              seeds = [b"position", market.key().as_ref(), user.key().as_ref()], bump)]
    pub position: Account<'info, Position>,
    #[account(mut, token::mint = config.mint, token::authority = user)]
    pub user_token: Account<'info, TokenAccount>,
    #[account(mut, seeds = [b"vault", market.key().as_ref()], bump = market.vault_bump)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}
```

**Payout (in `claim`, u128 math, rounds down, leftover dust stays in the vault):**
```rust
fn payout(m: &Market, p: &Position) -> u64 {
    let pool = (m.total_kept + m.total_broken + m.forfeited_bonds) as u128;
    let winners = (if m.final_outcome == 1 { m.total_kept } else { m.total_broken }) as u128;
    if m.status == Status::Void || winners == 0 { return p.amount; }      // void, or nobody won → refund
    if p.side != m.final_outcome { return 0; }
    ((p.amount as u128) * pool / winners) as u64
}
```
**Vault signer seeds:** `&[b"market", m.config.as_ref(), &m.id.to_le_bytes(), &[m.bump]]`.

> Config is seeded by its admin so Playground tests and the app each get their own config. Clients derive it from `NEXT_PUBLIC_CONFIG_ADMIN` (the fee payer pubkey).

### Tasks

**12:00–12:30: Playground up, stub deployed (go/no-go #1 at 12:45)**
- [ ] Open `beta.solpg.io` → New project → **Anchor** → name `kept`. Connect the Playground wallet and **save its keypair** (Settings → export).
- [ ] Get devnet SOL into the Playground wallet: `faucet.solana.com` (sign in with GitHub for higher limits). Deploying needs roughly **3–5 SOL**. Ask teammates to request from their own accounts and send to you if you hit limits.
- [ ] Paste `Config`, `Market`, `Position`, `Status`, and `initialize_config` + `create_market` (bodies can be minimal) → **Build** → **Deploy**.
- [ ] Export the IDL (Build panel → IDL → Export) → commit to `app/src/shared/idl/kept.json`. Post the **program ID** in chat.
- [ ] **Check the IDL format and tell P4.** Top-level `"address"` + `"metadata": {"spec": …}` = Anchor ≥ 0.30 format → `@coral-xyz/anchor@0.30.1`. Otherwise it's the old format → `@coral-xyz/anchor@0.29.0`. Client and IDL versions **must match**.
- [ ] ✅ **Go/no-go #1 (12:45):** a stub program is on devnet and the IDL is in the repo. If not: tell the team, switch to `custodial.ts` ([§13](#13-fallbacks-if-x-breaks-do-y)), and keep trying Anchor on the side until 14:00.

**12:30–14:00: Core instructions**
- [ ] `initialize_config`, `update_config`, `create_market` (inits market + vault), `place_stake`, `propose_outcome`, `finalize`, `claim`
- [ ] Errors: `NotOpen, PastDeadline, BeforeDeadline, StakeOutOfRange, BadSide, NotResolver, NotCouncil, AlreadyVoted, WindowOpen, WindowClosed, NotFinal, AlreadyClaimed, NoPosition, TextTooLong`
- [ ] Playground test (`tests/kept.test.ts`), the **worked example from CLAUDE.md**: wallets A (Broken 10), B (Broken 15), C (Kept 75); resolver proposes Broken; wait for the window; finalize; A claims and gets **+40.000000**; B gets 60; C gets 0. Use `update_config` to set a 5 s window for the test.
- [ ] Failure tests: stake 101 → `StakeOutOfRange`; non-resolver propose → `NotResolver`; claim twice → `AlreadyClaimed`
- [ ] **13:30: freeze account structs** and redeploy. Re-export the IDL and commit. After this, changing a struct breaks every existing market (they'd need re-seeding), so it needs team agreement.

**14:00–15:30: Challenge + council + integration**
- [ ] `challenge`, `council_vote` (2-of-3, Void path, bond refund vs forfeit)
- [ ] Tests: challenge after window → `WindowClosed`; council changes result → challenger's `claim` includes +10; council agrees → `forfeited_bonds` raises winners' payouts
- [ ] Sit with P4 for the first real `create_market` + `place_stake` from the browser

**15:30–16:45: Hardening**
- [ ] Final deploy, then copy `lib.rs` + tests into `program/` and commit
- [ ] Write `program/README.md`: open in Playground, build, deploy, export the IDL, where the keypair lives
- [ ] With P2: run `setup-devnet.ts` + `seed.ts` against the final program ID

**Deliverable:** program on devnet, Playground tests green, IDL + program ID in `main`.

---

## 7. P2: Backend (AI, server workflows, scripts, backend tests)

**Goal:** Everything server-side. Turn a link into a clean source, turn a source into a market draft, turn a market into an evidence-backed verdict, and run the workflows that move between them and sign with server keys.

### Files
```
app/src/server/**   app/src/app/api/{draft,resolve,relay,faucet,health}/**   app/scripts/**
app/src/shared/types.ts   app/src/shared/apiClient.ts   app/.env.example   app/instrumentation.ts
app/tests/api/**          (tests)  src/server/**/*.test.ts
```

### 7.1 Context layer: `src/server/context/`

| File | Does | Notes |
|---|---|---|
| `oembed.ts` | `fetchXPost(url) → SourceDoc` | `GET https://publish.twitter.com/oembed?url=<post>&omit_script=1&dnt=true`. Take `author_name` and `author_url`. Strip tags from `html` and take the `<p>` text; the last `<a>` is the date. No auth needed; single public posts only. |
| `tavily.ts` | `search(q) → EvidenceItem[]`, `extract(url) → SourceDoc` | `import { tavily } from "@tavily/core"`. `search(q, { searchDepth: "advanced", maxResults: 5, topic: "news" })`. Use `extract([url])` for article links. |
| `hash.ts` | `sha256Hex(text)` | Node `crypto`. Hash the **normalized** text (trim, collapse whitespace) so the same post always gives the same fingerprint. |
| `evidence.ts` | `gatherEvidence(market) → EvidencePack` | **Code builds the queries, not Claude** (deterministic and fast): `"{promiser} {key nouns of promise}"`, `"{promiser} {checkSource}"`, `"{promise keywords} {deadline year}"`. Dedupe by URL, keep the top 8, hash the pack. |

### 7.2 Intelligence layer: `src/server/intelligence/`

Two pure functions, with schemas checked twice: once by structured outputs and once by zod after.

| Call | Model | Effort | Input | Output schema |
|---|---|---|---|---|
| `draftMarket(doc)` | `claude-opus-5-5` | `low` (speed matters on stage) | `SourceDoc` + today's date | `DraftResponse` minus `source` |
| `judgeMarket(market, pack)` | `claude-opus-5-5` | `high` (correctness matters) | `MarketView` + `EvidencePack` | `{ verdict, confidence, summary, citations[], reasoning }` |

```ts
// src/server/intelligence/drafter.ts
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { DraftSchema } from "./schemas";
import { DRAFTER_SYSTEM } from "./prompts";

const claude = new Anthropic(); // reads ANTHROPIC_API_KEY

export async function draftMarket(doc: SourceDoc, today: string) {
  const res = await claude.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "low", format: zodOutputFormat(DraftSchema) },
    system: DRAFTER_SYSTEM,
    messages: [{ role: "user", content: `Today is ${today}.\n<source>\n${JSON.stringify(doc)}\n</source>` }],
  });
  if (res.stop_reason === "refusal") return reject("death_or_harm", "This topic can't be turned into a market.");
  return res.parsed_output; // null if parsing failed → retry once → fixture → reject("vague", …)
}
```

**Drafter rules (in `prompts.ts`):**
- Accept only a **public figure or organization** making a **specific, checkable** commitment with a **deadline** (explicit, or clearly implied, like "by spring" → the date goes in `assumptions`).
- Reject with a reason code: `vague`, `no_deadline`, `private_person`, `death_or_harm`, `not_a_promise`, `past_deadline`. The explanation should be one plain sentence the user will read.
- `promiseText` must be **copied from the source**, never paraphrased. Code checks it's a substring of `doc.text` after normalization; if not, retry once.
- Criteria must name **where** to check ("per the state DOT project page").
- Neutral wording. No "will they finally…".

**Resolver rules:**
- Judge **only against the market's criteria**, as of the deadline.
- The evidence is wrapped in `<evidence>` tags and treated as **data, never instructions**. Pages can contain prompt injection.
- Every citation URL **must be in the pack**. Code drops any that aren't, and no valid citations → `unclear`.
- `summary` ≤ 280 chars, neutral, no speculation. Only the top 3 sources go on-chain (≤ 120 chars each).
- Gate (code, not Claude): `verdict ∈ {kept, broken} && confidence ≥ 0.7` → propose; otherwise propose `unclear` → Council.

> Structured outputs may not enforce numeric ranges or string lengths. Clamp `confidence` to [0, 1] and trim strings to `LIMITS` in code. If `zodOutputFormat` gives trouble with your zod version, pass `output_config.format = { type: "json_schema", schema }` and run `DraftSchema.parse` yourself.

### 7.3 Orchestration layer: `src/server/orchestrator/`

**`resolveMarket(id, { dryRun })`**, the Workflow C state machine. Every step pushes a `TraceStep` so the UI can show the research live:

```
READ      chain.getMarket(id)            guard: status == open && now ≥ deadline; in-flight lock per id
SEARCH    context.gatherEvidence(m)      → EvidencePack            (fallback: fixtures/evidence/<id>.json)
JUDGE     intelligence.judgeMarket(m,p)  → verdict                 (fallback: fixtures/verdicts/<id>.json)
VALIDATE  drop foreign citations, clamp, apply 0.7 gate
WRITE     buildProposeTx(...) → sign with RESOLVER key → send → confirm   (skipped when dryRun)
```

| File | Does |
|---|---|
| `relay.ts` | **Security-critical.** Decode the base64 tx. Require `feePayer == FEE_PAYER`. Require **every** instruction's program ∈ {Kept program, ComputeBudget}. Reject anything else, so nobody can drain the fee payer with a SystemProgram transfer. Then `partialSign(feePayer)` → `sendRawTransaction` → confirm → return the signature. |
| `faucet.ts` | If the wallet's tUSDC ATA exists → `already_claimed`. Otherwise create the ATA (fee payer pays) and `mintTo` 100 tUSDC (mint authority = fee payer). The chain itself enforces "once". |
| `loop.ts` | Every 10 s: open markets past deadline → `resolveMarket`; proposed markets past window → `finalize` (as a convenience; anyone can). Started from `instrumentation.ts` when `RESOLVER_LOOP=1`, with a `globalThis.__keptLoop` guard so dev hot-reload doesn't start it twice. |
| `trace.ts` | `globalThis` `Map<id, TraceStep[]>` for `GET /api/resolve/[id]`. Lost on restart, which is fine because the chain keeps the summary and sources. |
| `keys.ts` | Load `FEE_PAYER_SECRET`, `RESOLVER_SECRET` (JSON byte arrays) from env. Server-only. |

### Tasks

**12:00–12:30: Keys and contracts**
- [ ] Anthropic key (`console.anthropic.com`) + Tavily key (`app.tavily.com`, free tier). Check both with one `curl`.
- [ ] `scripts/keys.ts` → generate the **fee payer** and **resolver** keypairs. Airdrop 2 SOL to each (`faucet.solana.com`).
- [ ] Write `types.ts` + `apiClient.ts` (§5.1) and `.env.example` → merge to `main` by **12:30**.
- [ ] Send `.env.local` to the team by private DM.
- [ ] Pick **3 demo promises** with the team: (a) a real past promise with a **clearly known outcome** (for live resolution); (b) a real future promise (for creating live); (c) a vague post (for the rejection). Save their URLs in `fixtures/`.

**12:30–14:00: Context + Intelligence (no UI needed)**
- [ ] `oembed.ts`, `tavily.ts`, `hash.ts`, `evidence.ts`
- [ ] `schemas.ts`, `prompts.ts`, `drafter.ts`, `resolver.ts`
- [ ] `scripts/ai-try.ts`: `npm run ai:try -- <url>` prints SourceDoc → DraftResponse. Run all 3 demo URLs. Then `npm run ai:try -- --resolve fixtures/market-a.json` prints EvidencePack → verdict.
- [ ] `POST /api/draft` live, with `DEMO_CACHE=1` returning `fixtures/drafts/<sha>.json` if Claude fails
- [ ] Save every good live response into `fixtures/` as you go. These are your stage fallback.

**14:00–15:30: Orchestration + devnet setup**
- [ ] `scripts/setup-devnet.ts`: create the tUSDC mint (6 decimals, authority = fee payer) → `initialize_config(resolver, council[3], 30, 10 tUSDC)` → print the env values to paste
- [ ] `faucet.ts` + `POST /api/faucet`; `relay.ts` + `POST /api/relay` (pair with P4 on the first relayed stake)
- [ ] `resolveMarket.ts` + `POST/GET /api/resolve/[id]` using P4's `buildProposeTx`
- [ ] `relay.test.ts`: refuses a tx whose fee payer isn't ours, one containing a SystemProgram transfer, and one calling an unknown program
- [ ] `scripts/doctor.ts` → `npm run doctor` prints a ✅/❌ table: env vars, RPC, SOL balances, Claude ping, Tavily ping, program account exists

**15:30–16:45: Quality + loop**
- [ ] `loop.ts` + `instrumentation.ts`
- [ ] Prompt tuning on the 3 demo promises until the draft reads cleanly and the verdict on (a) is correct with ≥ 0.7 confidence
- [ ] vitest: drafter **rejects** the vague post, a private-person post, and a harm-related post (recorded responses); a citation not in the pack is dropped; confidence 0.65 → council
- [ ] `tests/api/*.test.ts` (`npm run test:api`, against `npm run dev`): each route returns the `types.ts` shape; missing/bad input → 400; `/api/faucet` twice → `already_claimed`
- [ ] `scripts/seed.ts`: create the demo markets. The program requires `deadline > now` at creation, so at 16:45 seed market (a) with a deadline **2 minutes ahead**; it will be past by demo time. `DEMO_MODE=1` lets the drafter accept (a) even though its real-world deadline is already in the past.

**Deliverable:** `/api/draft`, `/api/resolve/[id]`, `/api/relay`, `/api/faucet` live; `npm run doctor` all ✅; `npm test` + `npm run test:api` green; fixtures for every demo step.

---

## 8. P3: Frontend UI (pages, design, UI tests)

**Goal:** The screens judges remember. It should feel like a **public record**, not a casino.

### 8.1 Design direction: "the civic ledger"

| Element | Choice | Why |
|---|---|---|
| Mood | Newspaper record + receipt. Calm, factual, paper-toned. No neon, no rockets, no "🚀 to the moon". | Tech for Good: this is accountability, not gambling. |
| Type | **Newsreader** (serif) for the quoted promise; **Inter** for UI; **JetBrains Mono** for amounts, hashes, countdowns. All via `next/font/google`. | The promise reads like a quote in a paper; numbers line up. |
| Colors | tokens on `:root`, dark mode via `prefers-color-scheme` | see below |
| Meaning | **Never color alone.** Kept = ✓ + green + the word; Broken = ✕ + vermilion + the word. | Color-blind safe; readable on a washed-out projector. |
| Motion | Odds bar width transition 300 ms ease-out; countdown ring; toast slide. Nothing bounces. Respect `prefers-reduced-motion`. | Motion signals "money moved" without feeling like a slot machine. |
| Scale | Base 17px; odds % and payout figures 40px+; test at 1280×720. | Readable from the back of the room. |

```css
:root {
  --paper: #FAFAF7; --ink: #16181D; --muted: #6B6F76; --line: #E4E2DA; --card: #FFFFFF;
  --kept: #1F7A4D;  --kept-bg: #E8F3EC;
  --broken: #B42318; --broken-bg: #FBEAE8;
  --pending: #B54708; --council: #5B4BC4; --focus: #2563EB;
}
@media (prefers-color-scheme: dark) { :root {
  --paper: #0E0F0C; --ink: #ECEDE8; --muted: #9A9D97; --line: #2A2C27; --card: #16181D;
  --kept: #3FB27F; --kept-bg: #12261B; --broken: #F97066; --broken-bg: #2A1513;
} }
```

### 8.2 Page map

| Route | Purpose | Key components |
|---|---|---|
| `/` | Browse promises | `MarketCard` grid, filters by status (Open · Resolving · Settled), "Paste a promise" CTA |
| `/create` | Workflow A | URL input (+ "paste text instead" link) → `SourceCard` with fingerprint → editable draft form with char counters at `LIMITS` → reject state with reason → Create |
| `/markets/[id]` | Workflow B/C/D | see the wireframe below |
| `/promisers/[handle]` | Public record | `PromiserScore` (Kept · Broken · Pending), list of their markets |
| `/leaderboard` | Forecaster accuracy | table: wallet, markets, accuracy %, net tUSDC |
| `/council` | Council inbox | markets in Challenged/Council, the AI proposal + evidence, 3 vote buttons, current votes |
| `/faucet` | Get 100 tUSDC | connect → claim → balance |

### 8.3 Market page wireframe

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ← All promises                                                    [● OPEN  · 2d 4h left]  │
├───────────────────────────────────────────────────────┬──────────────────────────────────┤
│  @GovExample · Governor of Example State              │  YOUR PREDICTION                 │
│                                                       │  ┌───────────┐ ┌───────────┐     │
│  “We will finish repaving Route 1 between College     │  │ ✓ KEPT    │ │ ✕ BROKEN  │     │
│   Park and Hyattsville by June 1, 2027.”              │  └───────────┘ └───────────┘     │
│                                                       │  Amount  [  10 ] tUSDC (1–100)   │
│  KEPT IF  repaving complete per state DOT page        │  If right you get ≈ 23.4 tUSDC   │
│  BROKEN IF  not complete by the deadline              │  [ Stake 10 on Broken ]          │
│                                                       │  No SOL needed: we pay the fee   │
│  Source  x.com/GovExample/status/…  ↗                 ├──────────────────────────────────┤
│  Fingerprint  9f2c…a41e  ✓ saved on Solana ↗          │  ODDS                            │
│                                                       │  ██████████████░░░░░░  71% KEPT  │
│                                                       │  $710 Kept · $290 Broken · 23 ppl│
├───────────────────────────────────────────────────────┴──────────────────────────────────┤
│ TIMELINE   ● Created ── ● Deadline ── ○ AI proposal ── ○ Challenge window ── ○ Final    │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ RESOLUTION (after deadline)                                                              │
│  AI proposes ✕ BROKEN · confidence 0.86          [◔ 0:24 left to challenge] [Challenge]  │
│  "As of June 1, 2027 the DOT page lists the project as 60% complete…"                    │
│  Sources: 1. dot.example.gov/route1 ↗  2. local-news.example/… ↗  3. …                   │
│  ▸ Show research trace (queries · 8 sources read · validation)                           │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**Every status has its own look** (`StatusChip` + panel state): Open (stake panel), Resolving (skeleton + "AI is researching"), Proposed (countdown ring + Challenge), Challenged/Council (violet, "Council reviewing · 1 of 2 votes"), Finalized (`PayoutReceipt` + Claim), Void ("Refunds available"). Also: empty, loading (skeletons, never spinners on the whole page), error with retry, wallet not connected, no tUSDC (→ faucet link), tx pending.

**Accessibility:** visible focus rings (`--focus`), `aria-live="polite"` on odds and countdown, buttons ≥ 44px, contrast ≥ 4.5:1 in both themes, every icon-only button has a label.

### Tasks

**12:00–12:30: Scaffold (merge to `main` first, by 12:25)**
- [ ] Run the scaffold commands in [§12](#12-tools-accounts-and-setup), installing **every** dependency for every lane now
- [ ] Create every file in [§4](#4-repo-structure-and-file-ownership) as a stub with an owner header (`// OWNER: P2. Ask before editing`)
- [ ] `layout.tsx` wraps children in `<Providers>` (P4's stub), fonts, tokens in `globals.css`, Prettier config, `npm run check` script

**12:30–14:00: Pages on mocks** (`NEXT_PUBLIC_CHAIN=mock`; P4's mock lands ~12:45)
- [ ] Components: `MarketCard`, `OddsBar`, `StatusChip`, `Countdown`, `PromiseQuote`, `SourceFingerprint`, `StakePanel`, `MarketTimeline`
- [ ] `/` grid and `/markets/[id]` in the Open state
- [ ] `/create` from a hard-coded `DraftResponse` (accept + reject states)

**14:00–15:30: Live data + resolution UI**
- [ ] Swap mocks for P4's hooks and P2's `apiClient.draft()`
- [ ] `ResolutionCard`, `EvidenceList`, `ResearchTrace` (polls `GET /api/resolve/[id]` every 1 s while running), `PayoutReceipt`
- [ ] "Run resolution" button (demo) → `apiClient.resolve(id)`
- [ ] `/faucet`

**15:30–16:45: Record + council + polish**
- [ ] `/promisers/[handle]` with `PromiserScore` (grouped from `listMarkets()`, no extra on-chain account needed)
- [ ] `/council`, `/leaderboard` (COULD)
- [ ] Every status state from §8.3; projector check at 1280×720; dark mode check
- [ ] `tests/e2e/*.spec.ts` (Playwright, `NEXT_PUBLIC_CHAIN=mock`, P4's burner wallet auto-connects): `create.spec` (accept + reject), `stake.spec` (1 ok, 101 blocked), `resolution.spec` (each status renders), `claim.spec` (receipt shows 40)
- [ ] `docs/TEST_CHECKLIST.md`: the manual checks Playwright can't do (real Phantom, wrong network, projector, dark mode); run it at CP3

**Deliverable:** every MUST screen finished on live devnet data; `npm run test:e2e` green; the demo is clickable start to finish.

---

## 9. P4: Frontend wallet + chain (client, Blinks, smoke test)

**Goal:** The bridge. Pages call simple hooks; you turn them into correct Solana transactions, route them through the fee payer, and read on-chain state back as `MarketView`.

### Files
```
app/src/chain/**   app/src/wallet/**   app/src/app/api/actions/**   app/src/app/actions.json/**
app/scripts/smoke-devnet.ts   app/scripts/demo-reset.ts   README.md   docs/RUNBOOK.md
```

### Key mechanics

**Gasless send path** (`tx.ts` → `sendViaRelay`):
```
build ix from IDL (program.methods.placeStake(side, amount).accounts({...}).instruction())
→ new Transaction({ feePayer: FEE_PAYER_PUBKEY, recentBlockhash }).add(ix)
→ wallet.signTransaction(tx)              // Phantom signs as `user` only (partial)
→ POST /api/relay { tx: base64(tx.serialize({ requireAllSignatures: false })) }
→ server validates, co-signs, sends → signature → toast with Explorer link → refetch market
```

**Reading state** (`read.ts`): `program.account.market.all()` and `program.account.position.all([memcmp owner])` → map base units ÷ 1e6, enum → string, `Pubkey.default` → `null`. Poll every 3 s on the market page, 10 s elsewhere.

**Anchor client version** must match P1's IDL: 0.30 format → `new Program(idl, provider)`; 0.29 format → `new Program(idl, PROGRAM_ID, provider)`.

**Blinks** (`/api/actions/stake`, `@solana/actions`):
- `GET` → `ActionGetResponse`: icon, title = the promise, description = odds, `links.actions` = [Kept 10] [Broken 10] [custom amount with `{amount}` parameter]
- `POST` `{ account }` → build `place_stake` with `feePayer = server`, **server `partialSign`s first**, return base64 via `createPostResponse`. Wallet adds the user signature and sends.
- Headers: `createActionHeaders({ chainId: "devnet" })` on every response, including `OPTIONS` (older package versions export `ACTIONS_CORS_HEADERS` instead)
- `/actions.json` → `{ "rules": [{ "pathPattern": "/markets/*", "apiPath": "/api/actions/stake?market=*" }] }`
- Public HTTPS: `cloudflared tunnel --url http://localhost:3000` → set `PUBLIC_BASE_URL`
- Test on **dial.to**: `https://dial.to/?action=solana-action:<PUBLIC_BASE_URL>/api/actions/stake?market=1&cluster=devnet`
- **Honest limit:** X only unfurls Blinks from registered actions, and devnet support there is unreliable. In the demo, show the X post containing the link, then open it on dial.to.

### Tasks

**12:00–12:30**
- [ ] `wallet/Providers.tsx`: `ConnectionProvider` (devnet RPC) + `WalletProvider` (wallet-standard auto-detects Phantom) + `WalletModalProvider` + Sonner `<Toaster/>`. Give it to P3 for the scaffold.
- [ ] `chain/index.ts` interface (§5.4) → merge by 12:30
- [ ] Install Phantom, switch to devnet (Settings → Developer Settings → Testnet Mode → Solana Devnet). Create 2 extra accounts for demo wallets A and B.

**12:30–14:00**
- [ ] `mock.ts` + `fixtures.ts` (6 markets covering every status) → **merge by 12:45 so P3 is unblocked**
- [ ] `payout.ts` + `payout.test.ts` (worked example: 10 × 100 ÷ 25 = 40; void refund; nobody on the winning side → refund)
- [ ] `pdas.ts`, `read.ts`, `anchor.ts` against P1's stub IDL
- [ ] `tx.ts` builders + `sendViaRelay` + **direct-send fallback** (user pays the fee) behind `NEXT_PUBLIC_GASLESS=0`
- [ ] `wallet/burner.ts`: a Keypair in `localStorage` exposed as a wallet (backup if Phantom misbehaves; also used by P3's Playwright tests). Auto-connect when `NEXT_PUBLIC_BURNER=1`

**14:00–15:30: Integration (the critical hour)**
- [ ] Real `createMarket` → `stake` → (P2 propose) → `finalize` → `claim` against devnet, with P1 and P2 at your desk
- [ ] `hooks.ts` complete; P3 switches `NEXT_PUBLIC_CHAIN=anchor`
- [ ] `buildProposeTx` handed to P2
- [ ] `read.test.ts`: base units ÷ 1e6, enum → string, `Pubkey.default` → `null`
- [ ] `scripts/smoke-devnet.ts` (`npm run smoke:devnet`): 3 fresh keypairs → faucet → create market (deadline +20 s) → stakes Broken 10 / Broken 15 / Kept 75 → `POST /api/resolve` → wait for the window → finalize → claim → **assert +40**. Prints ✅/❌ per step. This passing is **CP2**.

**15:30–16:45**
- [ ] `challenge`, `councilVote` paths + council wallet switching notes for the demo
- [ ] Blinks: `actions.json`, `GET/POST /api/actions/stake`, tunnel, dial.to test (COULD)
- [ ] `scripts/demo-reset.ts`: re-run seed, re-fund demo wallets, print the market URLs for the demo
- [ ] `README.md`: what it is, architecture diagram, how to run, program ID + Explorer link, team
- [ ] `docs/RUNBOOK.md`: setup → fund wallets → start server → tunnel → demo reset, with the recovery step for each fallback in §13

**Deliverable:** `NEXT_PUBLIC_CHAIN=anchor` drives the full MUST path gaslessly; `npm run smoke:devnet` green; mock mode still works with the backend off.

---

## 10. Timeline and checkpoints

| Time | P1: Blockchain | P2: Backend | P3: Frontend UI | P4: Frontend wallet + chain |
|---|---|---|---|---|
| **12:00–12:30** | Playground, SOL, stub deploy, IDL | Keys, `types.ts`, `.env.local`, demo promises | **Scaffold → main by 12:25** | `Providers`, `KeptChain` interface, Phantom devnet |
| **12:30** | ✅ **CP0: contracts locked.** Scaffold on main · everyone runs `npm run dev` · `types.ts` + `chain/index.ts` merged · `.env.local` shared · `npm run check` passes ||||
| **12:45** | ⚠️ **Go/no-go #1:** stub program on devnet + IDL in the repo? No → P1 starts `custodial.ts` ||||
| **12:30–14:00** | Core instructions + worked-example test | Context + Intelligence + `ai:try` + `/api/draft` | Pages on mocks | Mock (12:45), payout, anchor client, tx builders, burner |
| **14:00** | ✅ **CP1: every lane works alone.** P1 tests green for create/stake/propose/finalize/claim · P2 `ai:try` gives a good draft for (b), a reject for (c), the correct verdict for (a) · P3 every MUST page renders on mocks · P4 reads real markets from devnet. ⚠️ **Go/no-go #2:** Anchor path or custodial, decided now, no going back ||||
| **14:00–15:30** | Challenge + council; pair with P4 | setup-devnet, faucet, relay, resolve route | Live data, resolution UI, faucet page | **Integration**: real create → stake → finalize → claim |
| **15:30** | ✅ **CP2: MUST path end to end on devnet:** paste → draft → create → 2 wallets stake → odds move → resolve → 30 s → finalize → claim = 40. Proof: `npm run smoke:devnet` ✅ (P4) + `npm run test:api` ✅ (P2) ||||
| **15:30–16:45** | Hardening, final deploy, `program/` commit | Loop, prompt tuning, guardrail tests, seed | Promiser page, council, polish | Challenge/council tx, Blinks, README |
| **16:45** | 🧊 **CP3: feature freeze.** Only bug fixes after this. Run `seed.ts` for the demo state. `npm run test:e2e` ✅ (P3) + `docs/TEST_CHECKLIST.md` done. Rehearsal #1 ||||
| **16:45–17:30** | Explorer links ready | Pre-warm fixtures, check `doctor` | Fix rehearsal bugs, screenshots | Demo wallets funded, tunnel up |
| **17:30–18:00** | **Rehearsal #2 → record a 2-min backup video → submit Devpost** ||||

**Rule:** anything not working at 15:30 is cut or served from fixtures. Nothing new after 16:45.

### Checkpoint checklist (run at every ✅)

```bash
git fetch origin && git status                      # everyone: clean tree, rebased on main
cd app && npm run check                             # tsc --noEmit + vitest run, must pass on main
npm run doctor                                      # P2: all ✅
# then the CP-specific demo step, done live by someone who didn't build it
```

---

## 11. Git workflow: branch, commit, check

Three verbs only. No force-pushes to `main`, no long-lived branches, no committing on `main` directly.

### Branch
```
<lane>/<topic>     p1/stake-ix · p2/context-layer · p3/market-page · p4/relay-send
```
- Branch from fresh `main`. One branch per checkpoint block (~90 min), merged at the checkpoint, then deleted.
- Stay inside your own folders ([§4](#4-repo-structure-and-file-ownership)). If `git diff --stat origin/main` shows a file you don't own, stop and ask.

### Commit
```
<type>(<lane>): <what>          types: feat · fix · test · chore · docs
feat(p2): tavily evidence pack with url dedupe
fix(p4): convert base units before odds math
```
- Commit every 20–30 minutes, or whenever something works. Small commits make conflicts small.
- Never commit `.env.local`, keypair JSON files or `node_modules`. The scaffold's `.gitignore` covers `*.env*`, `*-keypair.json`, `keys/`.

### Check (before every merge)
```bash
git switch main && git pull --ff-only                  # 1. latest main
git switch p2/context-layer && git rebase main         # 2. replay your work on top
cd app && npm run check                                # 3. types + tests pass
git push -u origin p2/context-layer                    # 4. push the branch
# 5. open a PR → review pair (1↔2, 3↔4) checks it in 2 min → squash-merge → delete branch
```

**Merge order at each checkpoint:** P1 → P2 → P4 → P3 (the order things depend on each other). Each person rebases onto what the previous one merged.

### Conflict recipes
| Conflict in | Do |
|---|---|
| `package-lock.json` | `git checkout --theirs app/package-lock.json && cd app && npm install && git add app/package-lock.json` |
| `package.json` | Shouldn't happen (P3 owns it). If it does: keep both dependency lines, then do the lockfile recipe above |
| `types.ts` / `idl/` | Owner's version wins; the owner re-adds the other change |
| Anything else | You edited someone else's file. Take theirs and send them your change in chat |

---

## 12. Tools, accounts and setup

### Accounts and installs (do before 12:00 if you can)

| Tool | Who | Get it | Backup |
|---|---|---|---|
| Node 20+ and Git | all | nodejs.org | n/a |
| Phantom extension, **devnet** | all | phantom.app → Settings → Developer Settings → Testnet Mode | burner wallet (`wallet/burner.ts`) |
| Devnet SOL | P1 (5), P2 (2+2) | faucet.solana.com (GitHub login) | teammates send theirs; ask in the MLH/Solana booth |
| Solana Playground | P1 | beta.solpg.io | custodial fallback |
| Anthropic API key | P2 | console.anthropic.com | fixtures (`DEMO_CACHE=1`) |
| Tavily API key | P2 | app.tavily.com (free tier) | Claude's web search tool, then fixtures |
| cloudflared | P4 | `winget install --id Cloudflare.cloudflared` · mac: `brew install cloudflared` | `npx localtunnel --port 3000` or ngrok |
| Devnet RPC | P2/P4 | default `https://api.devnet.solana.com` | a free Helius devnet RPC key if you hit 429s |
| Solana Explorer | all | `explorer.solana.com/?cluster=devnet` | Solscan devnet |
| dial.to | P4 | dial.to | skip Blinks |

### Scaffold commands (P3, 12:00)

```bash
git switch main && git pull
git switch -c p3/scaffold
npx create-next-app@latest app --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd app
npx shadcn@latest init -d
npx shadcn@latest add button card badge input textarea dialog tabs progress tooltip separator skeleton table sonner
npm i @solana/web3.js@1 @solana/spl-token @coral-xyz/anchor@0.30.1 \
      @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui \
      @solana/actions @anthropic-ai/sdk @tavily/core zod bs58 lucide-react server-only
npm i -D tsx vitest prettier @playwright/test
npx playwright install chromium
```
(PowerShell: put the `npm i` on one line or replace `\` with a backtick.) Change the anchor version to `0.29.0` if P1 reports the old IDL format.

> Use **`@solana/web3.js` v1**. Anchor's TS client needs v1; v2 (`@solana/kit`) won't work with it.

**`package.json` scripts:**
```json
"dev": "next dev", "build": "next build",
"check": "tsc --noEmit && vitest run --passWithNoTests --exclude tests/api",
"doctor": "tsx scripts/doctor.ts", "keys": "tsx scripts/keys.ts",
"setup:devnet": "tsx scripts/setup-devnet.ts", "seed": "tsx scripts/seed.ts",
"ai:try": "tsx scripts/ai-try.ts", "tunnel": "cloudflared tunnel --url http://localhost:3000",
"test": "vitest run", "test:api": "vitest run tests/api", "test:e2e": "playwright test",
"smoke:devnet": "tsx scripts/smoke-devnet.ts", "demo:reset": "tsx scripts/demo-reset.ts"
```

### Environment: `app/.env.example` (P2)

```bash
# Server only, never NEXT_PUBLIC_
ANTHROPIC_API_KEY=
TAVILY_API_KEY=
SOLANA_RPC_URL=https://api.devnet.solana.com
FEE_PAYER_SECRET=            # JSON byte array; also tUSDC mint authority and config admin
RESOLVER_SECRET=             # JSON byte array; the AI proposer key in Config
DEMO_MODE=1                  # relaxes the draft "deadline must be future" check for seeding
DEMO_CACHE=0                 # 1 = serve fixtures when Claude/Tavily fail
RESOLVER_LOOP=0              # 1 = background resolver loop
PUBLIC_BASE_URL=             # cloudflared URL, for Blinks

# Browser
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=
NEXT_PUBLIC_TUSDC_MINT=
NEXT_PUBLIC_CONFIG_ADMIN=     # fee payer pubkey; Config PDA = ["config", admin]
NEXT_PUBLIC_FEE_PAYER_PUBKEY=
NEXT_PUBLIC_CHAIN=mock       # mock | anchor | custodial
NEXT_PUBLIC_GASLESS=1        # 0 = users pay their own (devnet) fees
NEXT_PUBLIC_BURNER=0         # 1 = auto-connect a burner wallet (tests, backup)
```

### Run
```bash
cd app && npm install && npm run doctor && npm run dev        # localhost:3000
npm run tunnel                                                # P4 only, for Blinks
```

---

## 13. Fallbacks (if X breaks, do Y)

| If this breaks | Do this | Who | Cost |
|---|---|---|---|
| **Anchor won't build or deploy in Playground** (go/no-go #1 or #2) | `NEXT_PUBLIC_CHAIN=custodial`: the server holds a per-market vault keypair; create/stake/resolution are written as **SPL Memo** JSON (`{t:"kept.stake",m:3,side:"broken"}`) next to SPL transfers; state is rebuilt from `getSignaturesForAddress`; payouts are server transfers using the same `payout.ts`. Records stay public and permanent; **in the pitch, say plainly** that funds are custodial in this build. | P1 writes `custodial.ts` | UI unchanged |
| Not enough devnet SOL for deploy | Every teammate claims from the faucet and sends to P1; cut `council_vote` to shrink the program | P1 | 15 min |
| Account struct change needed after 13:30 | Redeploy, then rerun `setup-devnet` + `seed` (old markets become unreadable) | P1 + P2 | 10 min |
| IDL/client mismatch errors | Match `@coral-xyz/anchor` to the IDL format (§6) | P4 | 5 min |
| Devnet RPC 429 / slow | Helius free devnet RPC in both RPC env vars; slow polling to 5 s | P4 | 5 min |
| Phantom rejects the partially signed tx / relay fails | `NEXT_PUBLIC_GASLESS=0` and pre-fund demo wallets with 1 devnet SOL each | P4 | 2 min |
| Phantom broken on a laptop | Burner wallet | P4 | 0 |
| Claude slow or down | `DEMO_CACHE=1` serves saved drafts and verdicts for the demo promises | P2 | 0 |
| Claude refuses (`stop_reason: "refusal"`) | Drafter → reject `death_or_harm`; resolver → `unclear` → council | P2 | built in |
| Tavily fails | Swap `gatherEvidence` to Claude's server-side web search tool (`web_search_20260209`) in the resolver call; then fixtures | P2 | 20 min |
| X oEmbed fails / post deleted | "Paste text instead": `DraftRequest.text`, kind `text`, still hashed | P3 + P2 | 0 |
| Blink doesn't unfurl on X | Open via dial.to; show the X post as the story | P4 | 0 |
| cloudflared fails | `npx localtunnel --port 3000` or ngrok; or skip Blinks | P4 | 5 min |
| `Buffer is not defined` in the browser | `npm i buffer` + `globalThis.Buffer ??= Buffer` at the top of `Providers.tsx` | P4 | 5 min |
| Venue Wi-Fi | Phone hotspot; worst case, the backup video from 17:30 | all | n/a |

---

## 14. Pitch and judge Q&A

**Pitch (30 s):**
> "Politicians and companies make public promises every day, and almost nobody checks back. Kept turns any public promise into a yes-or-no question with a deadline. People put capped test stakes on whether it'll be kept, so the odds show how believable it is. When the deadline passes, AI researches what happened and shows its sources, anyone who predicted can challenge it, a council settles disputes, and the program pays out. The promise, its fingerprint and the result live on Solana, where nobody can quietly delete them, including us."

| Question | Answer |
|---|---|
| Isn't this gambling? | Test tokens only, devnet, no cash value. Stakes are capped at 100 per person so no whale or promise-maker can buy the odds. The product is the public record; the stakes are what make the odds honest. |
| What if the AI is wrong? | It must cite sources from what it actually found; we drop any citation it didn't read. Below 0.7 confidence it doesn't propose at all. Anyone who predicted can challenge with a bond, and the council decides with 2 of 3 votes. |
| Why blockchain? | The money sits in a vault only the program can move, with no admin withdraw. Promises, results and votes can't be edited or deleted by anyone, including us. Fees are tiny, so we pay them and users never need SOL. |
| Who's on the council? | For the hackathon, three team wallets. In production: a rotating, public panel, with every vote on-chain and visible. |
| Prompt injection from web pages? | Evidence is passed as tagged data, the resolver only judges against fixed criteria, citations are checked in code, and humans can still challenge. |
| Privacy / harm? | Public figures and organizations only. The drafter rejects private people and anything about death or harm before a market can exist. |
| What did you actually build today? | Point at the Explorer: the program ID, a market account, the vault, the propose transaction signed by the resolver key. |

---

## 15. Relationship to CLAUDE.md

`CLAUDE.md` is the short version that Claude Code loads in every session: fixed decisions, business rules, the four roles and their folders. **This file is the full version:** tasks, timeline, contracts and fallbacks. If you change a role, folder or rule, change it in both files in the same commit.
