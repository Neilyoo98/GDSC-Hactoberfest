// OWNER: P3
export default function Faucet() {
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">Try it out</p>
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
          Token claims are coming soon. These demo tokens have no cash value.
        </p>
      </section>
    </>
  );
}
