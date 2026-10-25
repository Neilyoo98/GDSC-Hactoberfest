// OWNER: P3
import { markets } from '@/components/kept/demo';
import { MarketCard } from '@/components/kept/ledger';
export default function Council() {
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">Public review</p>
        <h1>The council desk.</h1>
        <p>
          Three council members. Two matching votes. Every decision on record.
        </p>
      </section>
      <p className="muted">
        Sample inbox. Council wallet authentication, evidence, and voting await
        P4’s hooks.
      </p>
      <div className="grid">
        {markets
          .filter((m) => m.status === 'Council')
          .map((m) => (
            <MarketCard market={m} key={m.id} />
          ))}
      </div>
    </>
  );
}
