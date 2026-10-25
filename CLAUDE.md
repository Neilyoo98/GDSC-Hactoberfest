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

The original outline had Member A (Backend) and Member B (Frontend). With four people, each side is split in two:

| Member | Role | Owns |
|---|---|---|
| **1: Chain lead** | Solana program | Anchor program: config, market, vault, stake, propose, challenge, council vote, finalize, claim, void/refund, promiser record, forecaster stats. Program tests. IDL handoff. |
| **2: Server and AI lead** | Backend services | Resolver server (Tavily → Claude → propose on-chain), draft API (X oEmbed/Tavily → Claude → market draft), fee-payer relayer, tUSDC mint and faucet, Blink action endpoints, admin/council setup scripts. |
| **3: Web lead** | Frontend core | Website, wallet connect, market list and market page (odds, stake, claim), promiser records, forecaster leaderboard, program client built from the IDL. |
| **4: Experience and integration lead** | Frontend flows and demo | Create-market flow (paste link → AI draft → edit → Create), challenge/finalize/council UI, Blinks and cloudflared tunnel, demo mode (30 s window), seed data, pitch/demo script, README. |

**Handoffs (the critical path):**
1. Member 1 publishes the IDL and program ID early, even if instructions are stubs. Members 2, 3, and 4 build against it.
2. Member 2 publishes API contracts (draft, faucet, Blink endpoints) as typed request/response shapes before implementing.
3. Member 3 and Member 4 share one program client module; Member 3 owns it.

Each member reviews one other member's PRs: 1↔2, 3↔4.

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
