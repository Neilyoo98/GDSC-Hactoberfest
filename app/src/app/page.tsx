// OWNER: P3
import Link from 'next/link';
import { MarketGrid } from '@/components/kept/ledger';
export default function Home() {
  return (
    <>
      <section className="home-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" />
            Promises. With follow-through.
          </p>
          <h1>
            Big promises.
            <br />
            <span>Did they keep them?</span>
          </h1>
          <p className="hero-description">
            They said it. Now let’s follow up.
            <br />
            Track public promises, predict the outcome, and see the evidence.
          </p>
          <Link href="/create" className="primary button hero-cta">
            Track a promise <span aria-hidden="true">↗</span>
          </Link>
          <p className="hero-note">
            Public commitments. Test tokens. Real accountability.
          </p>
        </div>
      </section>
      <section aria-labelledby="promises-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">The public record</p>
            <h2 id="promises-heading">Promises worth watching</h2>
          </div>
          <span className="sample-note">Sample promises</span>
        </div>
        <MarketGrid />
      </section>
    </>
  );
}
