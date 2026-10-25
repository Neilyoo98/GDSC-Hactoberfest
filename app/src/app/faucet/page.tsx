// OWNER: P3
export default function Faucet() {
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">Devnet only</p>
        <h1>
          A little conviction.
          <br />
          <em>Zero real money.</em>
        </h1>
      </section>
      <section className="panel form">
        <h2>Get 100 tUSDC</h2>
        <p>
          One allocation per wallet. Use test tokens to predict whether public
          promises will be kept.
        </p>
        <button className="primary" disabled>
          Connect wallet to claim
        </button>
        <p className="muted">
          Wallet and faucet integrations are pending P4 and P2. No tokens have
          been minted in this preview.
        </p>
      </section>
    </>
  );
}
