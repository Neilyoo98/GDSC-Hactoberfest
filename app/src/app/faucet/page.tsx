'use client';

import { useState } from 'react';
import { CHAIN_MODE } from '@/chain';
import { useKeptActions } from '@/chain/hooks';
import { ConnectWallet } from '@/wallet/ConnectWallet';

export default function Faucet() {
  const { wallet, faucet } = useKeptActions();
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function claim() {
    setWorking(true); setError(null); setMessage(null);
    try {
      await faucet();
      setMessage(CHAIN_MODE === 'mock'
        ? 'Mock mode recorded the faucet request; no tokens were minted.'
        : 'Your test-token allocation was sent.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The faucet request failed.');
    } finally { setWorking(false); }
  }
  return (
    <>
      <section className="hero compact">
        <p className="eyebrow">Devnet only</p>
        <h1>A little conviction.<br /><em>Zero real money.</em></h1>
      </section>
      <section className="panel form">
        <h2>Get 100 tUSDC</h2>
        <p>One allocation per wallet. Use test tokens to predict whether public promises will be kept.</p>
        {!wallet && <ConnectWallet />}
        {message && <p role="status" className="positive">{message}</p>}
        {error && <p role="alert" className="negative">{error}</p>}
        <button className="primary" disabled={!wallet || working} onClick={() => void claim()}>
          {working ? 'Sending test tokens…' : 'Claim 100 tUSDC'}
        </button>
        {wallet && <p className="muted">Connected wallet · <code>{wallet.publicKey.toBase58()}</code></p>}
        <p className="muted">Devnet test tokens only. They have no real-world value.</p>
      </section>
    </>
  );
}
