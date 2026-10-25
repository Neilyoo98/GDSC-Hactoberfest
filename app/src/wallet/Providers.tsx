// app/src/wallet/Providers.tsx    OWNER: P4
"use client";
import { useEffect, useMemo, type ReactNode } from "react";
import { Buffer } from "buffer";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { Toaster } from "sonner";
import { BurnerWalletAdapter, BurnerWalletName } from "./BurnerAdapter";
import "@solana/wallet-adapter-react-ui/styles.css";

if (typeof window !== "undefined") (globalThis as any).Buffer ??= Buffer;

const BURNER = process.env.NEXT_PUBLIC_BURNER === "1";

/** NEXT_PUBLIC_BURNER=1: select the burner so autoConnect connects it with no clicks. */
function AutoSelectBurner() {
  const { wallet, select } = useWallet();
  useEffect(() => {
    if (BURNER && !wallet) select(BurnerWalletName);
  }, [wallet, select]);
  return null;
}

export function Providers({ children }: { children: ReactNode }) {
  const endpoint = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  // Phantom is auto-detected through wallet-standard; the burner is only listed when enabled.
  const wallets = useMemo(() => (BURNER ? [new BurnerWalletAdapter()] : []), []);
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AutoSelectBurner />
          {children}
          <Toaster richColors position="bottom-right" />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
