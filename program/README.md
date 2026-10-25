# program/: Kept Anchor program (P1)

Built, deployed and tested in **Solana Playground** (`beta.solpg.io`). Nobody needs Rust installed.

## Files

| File | What |
|---|---|
| `src/lib.rs` | The whole program: 9 instructions, 3 account types, errors, payout math + Rust unit tests |
| `tests/kept.test.ts` | Playground test suite (Test tab) |
| `Cargo.toml` | Only for a local `cargo test` of the payout math. Playground ignores it. |

## Deploy in Playground

1. Open `beta.solpg.io` → **Create a new project** → framework **Anchor** → name `kept`.
2. Replace `src/lib.rs` with this repo's `src/lib.rs`. Add `tests/kept.test.ts` to the Playground `tests/` folder.
3. Connect the Playground wallet (bottom-left). **Export its keypair** (Settings → Wallet → export) and keep it safe. That wallet is the program's upgrade authority.
4. Fund it on devnet: `faucet.solana.com` → paste the wallet address. Deploying needs about **3–5 SOL**.
5. **Build** (Playground rewrites `declare_id!` with the new program ID) → **Deploy**.
6. **Export the IDL**: Build panel → IDL → Export → save to `app/src/shared/idl/kept.json`.
7. Post the **program ID** in team chat. Also say whether the IDL has a top-level `"address"` field (Anchor ≥ 0.30 format → `@coral-xyz/anchor@0.30.1`) or not (0.29 format → `@coral-xyz/anchor@0.29.0`).
8. Copy the `declare_id!` line Playground wrote back into this repo's `src/lib.rs` and commit.

## Test in Playground

Test tab → **Run**. About 1 minute, because the tests wait for real deadlines and the 5-second window.

The tests make their **own** Config (seeded by the Playground wallet) and their own test mint, so they never touch the app's config. Re-running is safe; the suite reuses the config it made.

| Test | Proves |
|---|---|
| worked example | 10 on Broken, 25 Broken of 100 → **+40**; 15 → +60; Kept → 0; `BeforeDeadline`, `WindowOpen`, `AlreadyClaimed` |
| bad stakes | 101 and 0 → `StakeOutOfRange`; side 4 → `BadSide`; second stake fails; non-resolver → `NotResolver` |
| council void | confidence 0.65 → Council; non-member → `NotCouncil`; double vote → `AlreadyVoted`; 2 × Void → refunds |
| challenge overturned | non-staker can't challenge; bond moves; 2 council votes overturn; challenger gets 40 + bond back |
| late challenge | after the window → `WindowClosed` |

## Accounts and seeds

| Account | Seeds |
|---|---|
| Config | `["config", admin]` |
| Market | `["market", config, id (u64 LE)]` |
| Vault (SPL token account, authority = market) | `["vault", market]` |
| Position | `["position", market, user]` |

Config is seeded by its **admin**, so the app's config (admin = server fee payer, created by P2's `setup-devnet.ts`) and the test config never collide. Clients need the admin pubkey to derive it: `NEXT_PUBLIC_CONFIG_ADMIN`.

## Instructions

| Instruction | Signers | Notes |
|---|---|---|
| `initialize_config(resolver, council[3], window, bond)` | admin | once per admin |
| `update_config(resolver, council[3], window)` | admin | e.g. 30 s demo ↔ 86400 s |
| `create_market(promiser, text, criteria, url, hash, deadline)` | creator + payer | payer = fee payer (rent) |
| `place_stake(side, amount)` | user + payer | 1–100 tUSDC, once per user per market |
| `propose_outcome(verdict, bps, summary, sources, evidence_hash)` | resolver | Kept/Broken ≥ 7000 bps → Proposed, else → Council |
| `challenge()` | user | must have a Position; bond = config.bond |
| `council_vote(outcome)` | council member | 2 matching → final; 3 different → Void |
| `finalize()` | nobody (any fee payer) | after the window, unchallenged |
| `claim()` | user | payout + bond refund if the council overturned |

Encoding for `side` / `verdict` / `outcome`: `1` Kept · `2` Broken · `3` Void (or Unclear from the AI).
