// OWNER: P3
export default function Leaderboard() {
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">The forecaster record</p>
        <h1>Good judgment adds up.</h1>
        <p>Accuracy and returns derived from settled on-chain positions.</p>
      </section>
      <section className="panel">
        <h2>No settled forecasters yet</h2>
        <p className="muted">
          Connect the chain client to populate wallet, market count, accuracy,
          and net tUSDC. Sample market odds do not represent real forecaster
          records.
        </p>
      </section>
    </>
  );
}
