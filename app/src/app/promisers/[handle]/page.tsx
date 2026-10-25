// OWNER: P3
import { notFound } from 'next/navigation';
import { markets } from '@/components/kept/demo';
import { MarketCard } from '@/components/kept/ledger';
export default async function Promiser({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const records = markets.filter((m) => m.handle === handle);
  if (!records.length) notFound();
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">Promiser record · Demo</p>
        <h1>{records[0].promiser}</h1>
        <p>
          {records.length} sample commitments · Outcomes await verified chain
          data.
        </p>
      </section>
      <div className="grid">
        {records.map((m) => (
          <MarketCard key={m.id} market={m} />
        ))}
      </div>
    </>
  );
}
