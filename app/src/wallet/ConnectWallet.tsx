'use client';

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

export function ConnectWallet() {
  return <BaseWalletMultiButton className="wallet-button" labels={LABELS} />;
}
