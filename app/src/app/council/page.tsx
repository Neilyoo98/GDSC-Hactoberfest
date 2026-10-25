import { CouncilInbox } from '@/components/kept/resolution';

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
      <CouncilInbox />
    </>
  );
}
