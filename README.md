# Kept

**Did they keep their promise?** Kept is a public promise tracker on Solana. Paste a public post. Claude turns it into a checkable question with a deadline and Kept/Broken criteria, and the market is created on-chain. People stake test USDC on the outcome. After the deadline, an AI resolver researches the evidence and proposes a verdict with sources. Anyone with a stake can challenge it during the challenge window, and a 3-person council settles challenges. Winners claim from the pool according to program rules.

Built at Hacktoberfest 2026 (GDSC x MLH, UMD) · Solana Partner Challenge + Tech for Good.

**Program (devnet):** [`GYupVpsMEY12UGgS1gUdabq4UvmbR6PvbmUewQbw7gap`](https://explorer.solana.com/address/GYupVpsMEY12UGgS1gUdabq4UvmbR6PvbmUewQbw7gap?cluster=devnet)

## How it works
- **Context:** X oEmbed and Tavily fetch the source and the evidence. Every source is fingerprinted with sha256.
- **Intelligence:** Claude drafts markets, rejects vague, private-person or harmful promises, and judges against the criteria. Anything below 0.7 confidence goes to the council.
- **Settlement:** An Anchor program on devnet holds every stake in a per-market vault. There is no admin withdraw.
- **Payout:** `stake × (total pool + forfeited bonds) ÷ winning side`. Example: 10 × 100 ÷ 25 = **40 tUSDC**.
- **Gasless:** A server fee payer co-signs, so users need **0 SOL**.
- **Blinks:** Any market can be staked from dial.to through Solana Actions.

## Architecture
```
UI (Next.js pages) ── hooks (src/chain/hooks.ts) ── KeptChain: mock | anchor
        │                                              │
        └── apiClient ── /api/draft · /api/resolve      └── tx builders → /api/relay (fee payer co-signs) → devnet
                         /api/faucet · /api/relay           Anchor program: Config · Market · Vault · Position
```
The chain is the database. Keys (Claude, Tavily, fee payer, resolver) live only on the server.

## Run it
See [docs/RUNBOOK.md](docs/RUNBOOK.md).
```bash
cd app && npm i
npm run doctor         # every row ✅
npm run dev            # http://localhost:3000
npm run check          # typecheck + unit tests (offline, mock chain)
npm run smoke:devnet   # full money path on real devnet, asserts +40
```

## Team
| Lane | Who |
|---|---|
| P1 Blockchain | Neil |
| P2 Backend + AI | net-bob |
| P3 Frontend UI | Noam |
| P4 Wallet, chain client, Blinks | aaron |
