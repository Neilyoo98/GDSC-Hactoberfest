# Kept Runbook

Owner: P4. Order of operations for setup, demo day, and recovery: setup → fund → start → tunnel → reset.

## 1. Setup (once)
1. Install Node 20+ and cloudflared (`winget install --id Cloudflare.cloudflared`).
2. `cd app && npm i`
3. Get `app/.env.local` from P2 by private DM (never commit it). It must have:
   `NEXT_PUBLIC_PROGRAM_ID`, `NEXT_PUBLIC_TUSDC_MINT`, `NEXT_PUBLIC_CONFIG_ADMIN`, `NEXT_PUBLIC_FEE_PAYER_PUBKEY`,
   `FEE_PAYER_SECRET`, `RESOLVER_SECRET`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `TAVILY_API_KEY`,
   `NEXT_PUBLIC_CHAIN=anchor`, `NEXT_PUBLIC_GASLESS=1`, `DEMO_WALLETS=<pk1>,<pk2>`.
4. `npm run doctor`: every row should be ✅.
5. Phantom: Settings → Developer Settings → **Testnet mode on → Solana Devnet**. Accounts: **Wallet A**, **Wallet B**.

## 2. Fund
- Fee payer and resolver need devnet SOL (faucet.solana.com). `npm run doctor` shows both balances.
- Users need **0 SOL**: the fee payer pays fees and rent.
- New wallets get 100 tUSDC once from `/faucet`. Demo wallets are topped up by `npm run demo:reset`.

## 3. Start
```bash
npm run dev        # http://localhost:3000
```

## 4. Tunnel (Blinks only)
```bash
npm run tunnel     # copy the https://…trycloudflare.com URL
```
Set `PUBLIC_BASE_URL=<that URL>` in `.env.local` and restart `npm run dev`. Test a Blink at
`https://dial.to/?action=solana-action:<PUBLIC_BASE_URL>/api/actions/stake?market=<id>&cluster=devnet`.
X only unfurls registered Blinks, so show it on dial.to.

## 5. Reset (before every rehearsal)
```bash
npm run demo:reset      # tops demo wallets up to 100 tUSDC, runs P2's seed, prints market + Blink URLs
npm run smoke:devnet    # needs npm run dev running; must end with ✅ SMOKE PASSED (~2 min)
```
The challenge window must be **30 s**. If it isn't, P1 runs `update_config`.

## 6. Council (scene 6)
- Council seats are P1, P2 and P3's second Phantom accounts, named `Kept Council N`. Their keys never leave their own wallets.
- Each member votes from their own laptop on `/council`. To vote from one laptop, switch the account in Phantom (top-left account menu), refresh, vote, and repeat. **Two matching votes** settle the market.
- The challenger (Wallet A) needs a stake in that market and 10 tUSDC for the bond.

## 7. If something breaks on stage

| Symptom | Fix |
|---|---|
| Phantom refuses to sign a tx it doesn't pay for | `NEXT_PUBLIC_GASLESS=0`, restart dev, send devnet SOL to the demo wallets |
| Phantom broken | `NEXT_PUBLIC_BURNER=1`, restart dev: a burner wallet connects automatically (fund it from `/faucet`) |
| `relay 4xx/5xx` | Check the fee payer has SOL (`npm run doctor`), then airdrop |
| Blockhash expired | Retry. The blockhash is fetched right before signing, so a second try works |
| Odds bar doesn't move | Refresh. Market pages poll every 3 s, other pages every 10 s |
| Devnet RPC down / 429 | Put a Helius devnet URL in **both** `SOLANA_RPC_URL` and `NEXT_PUBLIC_SOLANA_RPC_URL`, restart |
| OpenAI down | P2 sets `DEMO_CACHE=1` (cached drafts and verdicts) |
| Anchor no-go | `NEXT_PUBLIC_CHAIN=custodial` (P1's fallback) |
| `Buffer is not defined` | `Providers.tsx` sets `globalThis.Buffer`; make sure the `buffer` package is installed |
| Tunnel fails | `npx localtunnel --port 3000`, or skip Blinks |
| Everything is down | Play the backup video |
