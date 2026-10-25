'use client';
// OWNER: P3
import { useState } from 'react';
export default function Create() {
  const [text, setText] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [quote, setQuote] = useState(
    'We will introduce ten new electric buses by December 31, 2026.',
  );
  return (
    <>
      <section className="hero compact">
        <h1>Add a promise.</h1>
        <p>
          Start with a public promise. Review the exact words, deadline, and
          criteria before signing.
        </p>
      </section>
      <section className="form panel">
        <h2>01 / The source</h2>
        <label>
          Public post URL or original text
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste an X post link, article URL, or promise text"
          />
        </label>
        <button disabled title="Waiting for P2’s draft endpoint">
          Generate AI draft
        </button>
        <p className="muted">Try the sample draft to preview the flow.</p>
        <button className="primary" onClick={() => setLoaded(true)}>
          Load sample draft
        </button>
        {loaded && (
          <div className="draft">
            <h2>02 / Review sample draft</h2>
            <p className="chip">Demo only · No source verified</p>
            <label>
              Promiser
              <input defaultValue="Maryland Transit" maxLength={40} />
            </label>
            <label>
              Exact promise <small>{quote.length}/240</small>
              <textarea
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                maxLength={240}
              />
            </label>
            <label>
              Deadline
              <input type="date" defaultValue="2026-12-31" />
            </label>
            <label>
              ✓ Kept criteria
              <textarea
                maxLength={160}
                defaultValue="Ten new electric buses enter service by the deadline, according to the official transit fleet register."
              />
            </label>
            <label>
              ✕ Broken criteria
              <textarea
                maxLength={160}
                defaultValue="Fewer than ten new electric buses enter service by the deadline, according to the official transit fleet register."
              />
            </label>
            <button className="primary" disabled>
              Create on Solana · Wallet integration pending
            </button>
          </div>
        )}
      </section>
    </>
  );
}
