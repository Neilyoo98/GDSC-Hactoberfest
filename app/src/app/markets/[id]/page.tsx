// OWNER: P3
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { markets } from '@/components/kept/demo';
import { OddsBar, StakePanel, StatusChip } from '@/components/kept/ledger';
export default async function Market({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const market = markets.find((m) => m.id === Number(id));
  if (!market) notFound();
  return (
    <>
      <Link href="/" className="text-link">
        ← All promises
      </Link>
      <div className="detail">
        <article>
          <div className="row">
            <Link href={`/promisers/${market.handle}`}>
              {market.promiser} ↗
            </Link>
            <StatusChip status={market.status} />
          </div>
          <h1 className="detail-quote">“{market.quote}”</h1>
          <p>Deadline · {market.deadline}</p>
          <div className="criteria">
            <p>
              <b className="positive">✓ Kept if</b>
              <br />
              The stated commitment is complete by the deadline, verified
              against the promiser’s official public records.
            </p>
            <p>
              <b className="negative">✕ Broken if</b>
              <br />
              The commitment is incomplete at the deadline.
            </p>
          </div>
          <OddsBar market={market} />
          <p className="muted">
            Fictional UI fixture. Source URL, SHA-256 fingerprint, and Explorer
            receipt await real source data.
          </p>
        </article>
        <StakePanel market={market} />
      </div>
      <section className="explainer">
        <h2>Public record timeline</h2>
        <p>
          Recorded → Deadline → Evidence review → Challenge window → Final
          result
        </p>
        <p className="muted">This preview does not write to Solana.</p>
      </section>
    </>
  );
}
