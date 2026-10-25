# P3 UI checkpoint

Run `cd app && npm run check && npm run build`.

Manual checks:
- At 1280×720 and 390px wide, navigate all seven page types.
- Filter the ledger by Open, Resolving, and Settled.
- Open a market and change side and amount; reject amounts outside 1–100.
- Generate a draft from a public source; verify loading, errors, source fingerprint, rejection reasons, and editable fields.
- In VS Code's preview at `http://127.0.0.1:3000/create`, confirm the button becomes enabled after hydration and clicking sends `/api/draft`.
- Test an unreadable article: paste the source text in the fallback and confirm the URL is retained.
- Cancel a slow draft and change source input; confirm an old result cannot appear for the new source.
- Tab through navigation and forms; confirm focus visibility and labels.
- Check light/dark themes and reduced motion.
- Confirm every sample is labeled, and unconnected transactions are disabled.

Pending integration: P2 resolve/relay/faucet APIs, P4 wallet providers and chain hooks, live odds, countdown, evidence display, challenge, voting, finalize, and claim. Drafting and source fingerprints are live. No live devnet success is claimed by this checkpoint.
