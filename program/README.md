# program/: Kept Anchor program (P1)

Built with the Anchor CLI in WSL (`build.sh`) and deployed to devnet. The Playground tests still run in Solana Playground.

## Files

| File | What |
|---|---|
| `src/lib.rs` | The whole program: 9 instructions, 3 account types, errors, payout math + Rust unit tests |
| `tests/kept.test.ts` | Playground test suite (Test tab) |
| `build.sh` | Builds the program + IDL in WSL and runs the Rust unit tests |
| `env.sh` | Puts the Solana + Anchor tools on PATH |
| `Cargo.toml` | Plain crate manifest (same dependencies as `build.sh` uses) |

## Program ID

**`GYupVpsMEY12UGgS1gUdabq4UvmbR6PvbmUewQbw7gap`**, **deployed on devnet** ([Explorer](https://explorer.solana.com/address/GYupVpsMEY12UGgS1gUdabq4UvmbR6PvbmUewQbw7gap?cluster=devnet)). Upgrade authority: `Cz7PnNvnNhPAuuTAXAYv9Xd8qQkdnzTktcyTeUMdgkWs`. The program keypair is `~/.config/kept/kept-keypair.json` in P1's WSL, so the ID stays the same on every rebuild.

## Build (WSL / Linux, Anchor CLI 0.31.2 + Agave 2.3.13)

```bash
bash program/build.sh test     # builds kept.so + IDL, runs the Rust unit tests
```
`build.sh` assembles a standard Anchor workspace in `~/kept-ws` (so Windows never runs build output) and pins `blake3 = 1.5.5`, because newer versions need Rust 2024, which the Solana toolchain's cargo 1.84 can't read.

After a build, copy the outputs into the app:
```bash
cp ~/kept-ws/target/idl/kept.json app/src/shared/idl/kept.json
# then regenerate app/src/shared/idl/kept.ts from ~/kept-ws/target/types/kept.ts (keep the header and the IDL export)
```

## Deploy (devnet)

The deploy wallet is `~/.config/solana/id.json` (it is also the upgrade authority). It needs **about 2.9 SOL**: rent for a 411 KB program, plus a temporary buffer whose SOL is returned before the program data is paid for.
```bash
source program/env.sh          # or add ~/kept-tools/bin and ~/kept-tools/solana-release/bin to PATH
cd ~/kept-ws
solana program deploy target/deploy/kept.so --program-id target/deploy/kept-keypair.json --max-len $(stat -c %s target/deploy/kept.so)
```
`--max-len` set to the exact size keeps rent at about 2.9 SOL. Later upgrades that make the program bigger need `solana program extend`.

**Upgrade** (same program ID, the deploy wallet is the authority):
```bash
NEW=$(stat -c %s target/deploy/kept.so)
solana program extend GYupVpsMEY12UGgS1gUdabq4UvmbR6PvbmUewQbw7gap <extra-bytes>   # only if NEW > current data length
solana program deploy target/deploy/kept.so --program-id target/deploy/kept-keypair.json --with-compute-unit-price 10000 --max-sign-attempts 100
```
An upgrade needs a **temporary buffer the size of the new program** (about 3.1 SOL for 447 KB), refunded when the upgrade finishes. If a deploy fails partway, reclaim the buffer with `solana program close --buffers`.

**Backup:** Solana Playground (`beta.solpg.io`): paste `src/lib.rs`, build, deploy, export the IDL. This uses a different program ID.

## Tests

Test tab → **Run**. About 3 minutes, because the tests wait for real deadlines and the 5-second window, measured on the chain clock.

**Status:** 5/5 pass against the deployed program on devnet (2026-10-25).

The tests make their **own** Config (seeded by the Playground wallet) and their own test mint, so they never touch the app's config. Re-running is safe; the suite reuses the config it made.

| Test | Proves |
|---|---|
| worked example | 10 on Broken, 25 Broken of 100 → **+40**; 15 → +60; Kept → 0; `BeforeDeadline`, `WindowOpen`, `AlreadyClaimed` |
| bad stakes, bad votes | 101 and 0 → `StakeOutOfRange`; side 4 → `BadSide`; second stake fails; vote before a dispute → `NotVoting`; non-resolver → `NotResolver` |
| unsure AI → public vote | confidence 0.65 → Voting; a non-staker votes; one vote per wallet; `VoteOpen` / `VoteClosed`; 25 Broken vs 10 Kept → Broken; voters get 28 / 7 / 0 of the 35 pool |
| challenge overturned | non-staker can't challenge; bond moves; vote overturns the AI; challenger gets 40 + bond back |
| tie → Void | 10 vs 10 → Void; stakers and voters refunded |
| late challenge | after the window → `WindowClosed` |

## Accounts and seeds

| Account | Seeds |
|---|---|
| Config | `["config", admin]` |
| Market | `["market", config, id (u64 LE)]` |
| Vault (SPL token account, authority = market) | `["vault", market]` |
| Position | `["position", market, user]` |
| Vote | `["vote", market, voter]`: one vote per wallet per market |

Config is seeded by its **admin**, so the app's config (admin = server fee payer, created by P2's `setup-devnet.ts`) and the test config never collide. Clients need the admin pubkey to derive it: `NEXT_PUBLIC_CONFIG_ADMIN`.

## Instructions

| Instruction | Signers | Notes |
|---|---|---|
| `initialize_config(resolver, challenge_window, vote_window, bond)` | admin | once per admin |
| `update_config(resolver, challenge_window, vote_window)` | admin | e.g. 30 s demo ↔ 86400 s |
| `create_market(promiser, text, criteria, url, hash, deadline)` | creator + payer | payer = fee payer (rent) |
| `place_stake(side, amount)` | user + payer | 1–100 tUSDC, once per user per market |
| `propose_outcome(verdict, bps, summary, sources, evidence_hash)` | resolver | Kept/Broken ≥ 7000 bps → Proposed, else → Voting |
| `challenge()` | user | must have a Position; bond = config.bond; → Voting |
| `cast_vote(choice, amount)` | voter + payer | **anyone**; 1–100 tUSDC, once per wallet; only while Voting |
| `finalize()` | nobody (any fee payer) | Proposed after the challenge window, or Voting after the vote window (most tUSDC wins; tie/none → Void) |
| `claim()` | user | stake payout + bond refund if the vote overturned the AI |
| `claim_vote()` | voter | winners: `lock × all votes ÷ winning votes`; losers 0; tie/none → refund |

Encoding for `side` / `verdict` / `choice` / `outcome`: `1` Kept · `2` Broken · `3` Void (or Unclear from the AI). Statuses: `Open`, `Proposed`, `Voting`, `Finalized`, `Void`.
