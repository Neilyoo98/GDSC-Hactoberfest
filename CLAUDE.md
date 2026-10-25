# CLAUDE.md — Kept

> Did they keep their promise? A public promise tracker on Solana.
> Hacktoberfest 2026 (GDSC x MLH) · Tracks: Solana Partner Challenge + Tech for Good
> Event: 10:00 AM–8:00 PM · Team of 4

## What we're building

Paste a public promise from X or the news. AI turns it into a yes/no market with a deadline. People stake test USDC on Kept or Broken. After the deadline, AI researches the outcome and proposes a result with sources. Anyone who predicted can challenge it. A 3-person council settles challenges. The program pays winners, and the result lives on Solana permanently.

## Fixed decisions (do not relitigate)

| Area | Decision |
|---|---|
| Chain | Solana **devnet**, **Anchor**. The chain is the backend: **no database**. |
| Money | **tUSDC** (our own devnet test stablecoin). One vault per market. 1–100 per person per market. No real money. |
| Vaults | Only the program can move funds. **No admin withdraw.** |
| AI | Claude API (server-side only), Tavily search API, X oEmbed (single public posts by URL). |
| Fees | Server pays network fees; users never need SOL. |
| Wallet | Phantom. |
| Blinks | Solana Actions/Blinks for predicting from an X link. Needs a public HTTPS URL via a **cloudflared tunnel** (Blinks only). |
| Hosting | Localhost for everything else. |

## Team and roles (4 people)

The team has four clear areas of ownership: one person leads the frontend, one leads the backend, one owns the Solana blockchain program, and one contributes to the frontend while leading testing and integration. The fourth member pairs with the frontend lead rather than creating a second, separate frontend implementation.

| Member | Role | Owns |
|---|---|---|
| **1: Solana blockchain lead** | On-chain program | Solana devnet + Anchor program: config, market, vault, stake, propose, challenge, council vote, finalize, claim, void/refund, promiser record, and forecaster stats. Owns program tests and the IDL handoff. |
| **2: Backend lead** | Server services | Resolver server (Tavily → Claude → propose on-chain), draft API (X oEmbed/Tavily → Claude → market draft), fee-payer relayer, tUSDC mint and faucet, Blink action endpoints, and admin/council setup scripts. |
| **3: Frontend lead** | Core web application | Website foundation, wallet connect, market list and market page (odds, stake, claim), promiser records, forecaster leaderboard, and the shared program client built from the IDL. Owns frontend architecture and shared UI conventions. |
| **4: Frontend and testing lead** | Frontend flows, quality, and integration | Pairs with Member 3 on the create-market, challenge/finalize/council, and demo flows. Owns frontend flow testing, end-to-end integration checks, Blinks and cloudflared demo wiring, demo mode (30 s window), seed data, pitch/demo script, and README. |

**Handoffs (the critical path):**
1. Member 1 publishes the IDL and program ID early, even if instructions are stubs. Members 2, 3, and 4 build against it.
2. Member 2 publishes API contracts (draft, faucet, Blink endpoints) as typed request/response shapes before implementing.
3. Member 3 and Member 4 share one program client module; Member 3 owns it.

Each member reviews one other member's PRs: 1↔2, 3↔4.

### Step-by-step plan by member

Follow the steps in order, but keep the handoffs small and early. Share interfaces and blockers as soon as they appear; do not wait for a feature to be finished before integrating it.

#### Member 1: Chain lead

1. **Set up the Anchor program and publish its interface (10:00–11:00).** Confirm the devnet program ID, create the program skeleton, and publish an initial IDL with the instruction names, accounts, arguments, and shared enums. Stub instructions are enough for the first handoff. Tell Members 2–4 where the IDL and program ID live.
2. **Define the account model and invariants.** Sketch config, market, per-market vault, prediction/stake, challenge, council vote, and user-stat accounts. Confirm PDA seeds and token-account ownership with Member 2 before implementation. Enforce one vault per market and program-only transfers; there is no admin withdrawal path.
3. **Implement initialization and market creation.** Add one-time config setup and market creation. Persist the exact promise text, source link, and source hash, plus deadline and objective resolution criteria. Validate required fields and prevent invalid or duplicate initialization as appropriate.
4. **Implement staking and market totals.** Support Kept/Broken stakes from 1–100 tUSDC per person per market, update side totals, and prevent repeat or over-cap stakes. Verify token mint, authority, and vault constraints on-chain.
5. **Implement proposing and settlement paths.** Add proposal, challenge, council vote, finalize, and void/refund flows. Enforce the deadline, challenge window, prediction requirement for challengers, three council members with two matching votes, and the bond return/forfeit rules. A low-confidence or unclear AI result must be handled through the council path rather than accepted as a normal proposal.
6. **Implement claims and records.** Add winner payout and void refunds, then update promiser records and forecaster stats at the correct settlement points. Use checked arithmetic and account for forfeited bonds in the winning pool. Implement the worked payout example in Business rules as a test before finishing the claim instruction.
7. **Test every instruction and hand off usable builds.** For each instruction, cover a successful path and at least one rejected path, including unauthorized token movement and invalid amounts. Keep the IDL current, share generated types with Members 2 and 3, and communicate any interface changes immediately.
8. **Integrate and review.** Pair with Member 2 on relayer transaction construction and token accounts; pair with Member 3 on client account derivations. Review Member 2's PRs and help resolve on-chain integration failures during the end-to-end demo.

#### Member 2: Server and AI lead

1. **Publish API contracts before building endpoints (10:00–11:00).** Define shared typed request/response and error shapes for market drafting, faucet, relaying, resolver proposals, and Blink actions. Coordinate the market and instruction fields with Members 1, 3, and 4; keep the shared types in one package/folder.
2. **Set up server configuration and secret handling.** Load Claude, Tavily, server signer, admin, and fee-payer secrets from local environment files. Add safe startup checks and ensure secrets never enter frontend bundles, logs, or committed files. Point all Solana connections to devnet.
3. **Build the market draft endpoint.** Accept a public X post URL or supported news input, fetch single-post X content through oEmbed where applicable, and use Tavily for checkable sources. Ask Claude for a structured draft with the promiser, exact promise, deadline, objective pass/fail criteria, and source. Validate the response against a schema before returning it.
4. **Enforce content guardrails and useful errors.** Reject vague/no-deadline promises, private individuals, and content about death or harm with plain explanations. Return validation errors that Member 4 can display and allow the user to edit a valid draft before on-chain creation.
5. **Build the tUSDC setup and faucet.** Create the devnet mint/setup script and a faucet that gives a new wallet 100 tUSDC once. Make the operation safe to retry and return typed success/failure information for the UI.
6. **Build the fee-payer relayer.** Accept only the approved transaction shapes, validate the user and instruction data, have the user authorize/sign the intended action, and pay network fees with the server fee-payer. Never take custody of user signing authority or allow the relayer to bypass program checks.
7. **Build the outcome resolver.** After the deadline, gather evidence with Tavily, ask Claude for a supported outcome and confidence with cited sources, validate the structured response, and submit a proposal only for Kept/Broken at confidence ≥ 0.7. For unclear or low-confidence outcomes, leave the market for the council path. Coordinate signer and instruction details with Member 1.
8. **Implement and validate Blink endpoints.** Build the Solana Actions metadata/action endpoints against the published IDL and shared API types. Test them locally first; coordinate with Member 4 for the public HTTPS cloudflared tunnel needed by Blinks.
9. **Integrate, observe, and review.** Verify draft → create and resolver → propose against devnet. Return enough source and status information for honest UI states without exposing secrets. Review Member 1's PRs, especially account constraints, token movement, and the relayer boundary.

#### Member 3: Web lead

1. **Agree on the shared client boundary (10:00–11:00).** Set up the frontend skeleton and coordinate the single program-client module with Member 4. Consume Member 1's early IDL/program ID and Member 2's API types; do not create parallel versions of either.
2. **Build wallet and network foundations.** Add Phantom connect/disconnect, show the active wallet and devnet status, and handle missing-wallet or wrong-network states clearly. Route user actions through the agreed fee-payer flow so users do not need SOL.
3. **Build market discovery from chain data.** Fetch markets from program accounts, show pending/proposed/challenged/finalized/void status, and provide useful loading, empty, and error states. Keep the chain as the source of truth; do not add a database.
4. **Build the market detail and prediction experience.** Display the exact promise, source, deadline, current Kept/Broken totals and odds, and a stake form constrained to 1–100 tUSDC. Show confirmation and transaction status, then refresh totals from on-chain state.
5. **Add claim and refund views.** Show whether the connected wallet can claim or receive a void refund, the expected amount, and whether the action has completed. Derive results from the program rather than displaying optimistic or invented settlement states.
6. **Add promiser records and forecaster leaderboard.** Read the corresponding on-chain stats and provide clear empty states. These are lower priority than create, stake, propose, finalize, and claim.
7. **Make the client reusable by Member 4.** Expose typed helpers for account reads, PDA derivation, transaction construction, and refresh/error handling. Document the interface and tell Member 4 when a usable stub is available.
8. **Integrate and review.** Run through the full create/stake/settle/claim path with Members 1 and 2, resolve wallet and account issues, and review Member 4's PRs for shared-client reuse and consistent UI states.

#### Member 4: Frontend and testing lead

1. **Set the frontend and test baseline (10:00–11:00).** Pair with Member 3 to agree on routing, shared components, client usage, and frontend ownership boundaries. Create the initial test checklist for core user flows. Agree with Member 2 on draft API types and validation/error states before wiring screens.
2. **Build frontend flows with Member 3's shared client.** Implement the create-market flow: accept a supported public post or news URL, call the draft endpoint, display validation errors, and let the user edit the generated promise, deadline, and pass/fail criteria before confirming creation. Keep the program client and account helpers owned by Member 3.
3. **Build challenge, finalize, and council screens.** Show eligibility, required challenge bond, challenge-window time, proposed sources, council votes, and available actions based on actual on-chain state. Keep pending, proposed, challenged, finalized, and void states distinct.
4. **Test frontend flows as they are built.** Check wallet connect/disconnect, wrong-network and empty states, draft success and rejection, edited market creation, stake amount boundaries (1 and 100 tUSDC), transaction pending/error/success states, challenge eligibility, and claim/refund visibility. Report failures with reproducible steps and coordinate fixes with the owner of the affected layer.
5. **Coordinate the Blink demo.** Work with Member 2 to connect the action endpoints and with Member 3 to reuse transaction/client utilities. Start the cloudflared HTTPS tunnel only for the Blink path, verify the shared public URL, and keep a website-staking fallback if the tunnel fails.
6. **Prepare demo mode and seed data.** Coordinate with Member 1 so the 30-second challenge window is a config value, not a hard-coded production rule. Add devnet setup/seed steps and verify the demo uses test USDC only.
7. **Own end-to-end integration checks and rehearsal.** Write a concise runbook for environment setup, wallet funding, server startup, tunnel startup, and demo reset. Exercise create → stake → propose → finalize → claim, then challenge → council vote → settlement, and record exact recovery steps for likely failures.
8. **Finish the README and submission materials.** Document architecture, setup commands, required environment variables by name only (never values), devnet-only configuration, known demo limits, test/run commands, and the team pitch. Keep instructions aligned with what has actually been tested.
9. **Review and stabilize the frontend.** Review Member 3's frontend PRs for consistent states, shared-client reuse, and flow coverage. At feature freeze, focus on fixing the live path and cut features only in the stated cut order.

## Architecture

```
X post / news ──► Draft API (Member 2) ──► Claude drafts market ──► User edits ──► create_market (on-chain)
Phantom ──► stake (server pays fee) ──► market vault ──► odds from on-chain totals
Deadline ──► Resolver (Tavily + Claude) ──► propose (Kept/Broken) ──► challenge window
   ├─ no challenge ─► anyone finalizes
   └─ challenge ($10 bond) ─► 3-person council, 2 matching votes decide (Kept/Broken/Void)
Claim ──► stake × (total pool + forfeited bonds) ÷ winning side
```

### Roles in the system

| Role | Does | Signs with |
|---|---|---|
| Forecaster | Creates markets, predicts, challenges, claims | Phantom (server pays fees) |
| AI proposer (server) | Posts proposed results | Server key |
| Council (3) | Decides challenged markets | Their own wallets |
| Anyone | Finalizes after the window | Any wallet |
| Admin | One-time config | Admin key |

## Business rules (enforce on-chain where possible)

- Stake: **1–100 tUSDC** per person per market. Cap exists so no one can control odds.
- Challenge bond: **10 tUSDC**; only people who predicted may challenge.
- Challenge window: **24 h** in production, **30 s** in demo (config value, not hard-coded).
- AI proposes only if answer is Kept or Broken **and confidence ≥ 0.7**. Otherwise (Unclear or low confidence) no proposal is made and the market goes to the council.
- Council: 3 members, 2 matching votes decide. Outcomes: Kept, Broken, Void.
- If council **changes** the proposed result: challenger's bond is returned. If not: bond is forfeited to the winners.
- Payout: `stake × (total market money + forfeited bonds) ÷ winning side total`. Example: you staked $10 on Broken, the market holds $100 total, and $25 is on Broken, so you receive 10 × 100 ÷ 25 = $40. **Write a test for this worked example before the claim instruction.**
- Void: everyone is refunded.
- Faucet: new wallets get 100 tUSDC once.
- Each market stores exact promise text, source link, and source hash (fingerprint) on-chain.

## Content rules (AI drafting guardrails)

The draft step must **reject**, with a plain explanation:
- Vague promises or ones with no deadline.
- Private individuals (public figures and organizations only).
- Anything about death or harm.

Drafts must have: who promised, exact promise, deadline, objective pass/fail criteria naming a checkable source.

## Security and secrets

- Claude, Tavily, server key, admin key, and fee-payer keys live in `.env` files. **Never commit them. Never expose them to the browser.**
- All Claude and Tavily calls happen server-side.
- Council keys are held by the council members themselves.
- Devnet only. Never point at mainnet.

## Conventions

- Language: TypeScript for server and frontend; Rust/Anchor for the program.
- Types for API shapes live in one shared package/folder; do not duplicate them.
- Prefer small PRs into `main`; rebase before merging; no long-lived branches.
- Every on-chain instruction gets at least a happy-path test and one failure-path test.
- AI outputs must be validated (schema-check the JSON from Claude) before use.
- Keep UI states honest: show pending, proposed, challenged, finalized, void.

## Timeline (10:00–20:00)

| Time | Goal |
|---|---|
| 10:00–11:00 | Repo setup, program ID + IDL stub, API contracts, design skeleton |
| 11:00–14:00 | Core build: program instructions (1), draft + resolver + faucet (2), market page + wallet (3), create flow (4) |
| 14:00–16:00 | Integration: end-to-end create → stake → propose → finalize → claim |
| 16:00–17:30 | Challenge/council path, Blinks via tunnel, leaderboard and records |
| 17:30–19:00 | Demo mode (30 s window), seed data, bug bashing, README |
| 19:00–20:00 | Demo rehearsal and submission. **Feature freeze at 17:30.** |

## Demo script (must work live)

1. Paste a real public promise → AI draft → edit → Create.
2. Two wallets stake on opposite sides; odds move.
3. Open the Blink link from X; stake from there.
4. Window passes (30 s); AI proposes with sources.
5. Challenge it; council votes; result settles.
6. Winner claims; promiser record and leaderboard update.

## If time runs short (cut order)

1. Leaderboard polish
2. News search input (keep X link input)
3. Blinks (keep website staking)
4. Never cut: create, stake, propose, finalize, claim.

## Working with Claude on this repo

- Check this file's **fixed decisions** and **business rules** before suggesting changes.
- Don't add a database, an admin withdraw, or mainnet/real-money paths.
- Ask which member's area a task belongs to if unclear, and keep changes inside that area unless asked.
