# Connect the Solana workflows to the promise experience

## Summary

Integrate the backend workflows, Noam’s refreshed frontend, and the Solana wallet and transaction scaffolding into one usable promise tracking flow. Users can review an AI-generated draft, connect a wallet, create a market, and interact with its on-chain lifecycle.

## What changed

### Backend

- Added schema-validated market resolution using public evidence, AI judgment, citations, and a trace of the resolution steps.
- Implemented the fee-payer relay with transaction signature checks and an allowlist of supported Kept program instructions.
- Implemented the devnet test-token faucet and health endpoint.
- Added request and response validation for resolution data shared between the frontend and API.

### Frontend

- Restored Noam’s updated visual design, responsive styling, AI drafting progress state, and answer reveal treatment.
- Connected the redesigned draft review to the wallet-backed “Create on Solana” action while retaining source links and SHA-256 fingerprints.
- Connected market cards and detail pages to live chain data and wallet actions for predictions, challenges, votes, finalization, and claims.
- Restored the live council inbox with wallet-based voting.
- Added wallet connection controls and clear connection, loading, and error states.

### Solana setup

- Connected the wallet provider and adapters to the app layout and chain hooks.
- Wired transaction construction and relay signing into the market actions.
- Kept devnet token handling and chain configuration separate from the UI flow.

## Verification

- `npm run lint` passes.
- The local homepage returned HTTP 200 and rendered in Next.js Webpack dev mode. Webpack mode avoids the Anchor module error seen with Turbopack in this environment.
- Live devnet transactions and the full automated test suite were not run as part of this verification.

## Notes

- Market creation and resolution require the corresponding wallet, RPC, and service configuration.
- The faucet is for devnet test tokens only; they have no real-world value.
