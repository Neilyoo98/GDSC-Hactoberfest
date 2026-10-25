// OWNER: P3
import { MarketGrid } from '@/components/kept/ledger';
export default function Home() {
  return (
    <>
      <section className="hero">
        <h1>Did they keep their promise?</h1>
        <p className="muted">
          Track public commitments. Predict the outcome. Check the evidence.
        </p>
      </section>
      <section aria-labelledby="promises-heading">
        <h2 id="promises-heading" className="sr-only">
          Promises
        </h2>
        <MarketGrid />
      </section>
    </>
  );
}
