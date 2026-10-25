'use client';

import { useSyncExternalStore } from 'react';
import { BaseWalletMultiButton } from '@solana/wallet-adapter-react-ui';

// Users connect their own wallet (Phantom, Solflare, Backpack… via wallet-standard).
// Once connected the button shows the address, with copy / change / disconnect.
const LABELS = {
  'no-wallet': 'Connect wallet',
  'has-wallet': 'Connect',
  connecting: 'Connecting…',
  'copy-address': 'Copy address',
  copied: 'Copied',
  'change-wallet': 'Change wallet',
  disconnect: 'Disconnect',
} as const;

const subscribe = () => () => {};

export function ConnectWallet() {
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  // The adapter can restore a selected wallet from browser storage before the
  // client hydrates. Render a stable placeholder until then to avoid mismatched
  // server and client wallet markup.
  if (!hydrated) {
    return (
      <div className="wallet-adapter-dropdown">
        <button
          type="button"
          className="wallet-adapter-button wallet-button"
          disabled
          aria-busy="true"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  return <BaseWalletMultiButton className="wallet-button" labels={LABELS} />;
}
