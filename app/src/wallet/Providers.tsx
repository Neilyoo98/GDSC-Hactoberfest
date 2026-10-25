// app/src/wallet/Providers.tsx    OWNER: P4
"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Buffer } from "buffer";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { Toaster } from "sonner";
import { BurnerWalletAdapter, BurnerWalletName } from "./BurnerAdapter";
import {
  generateTestWallet,
  loadTestWallets,
  saveTestWallets,
  TestWalletAdapter,
  type StoredTestWallet,
} from "./TestWalletAdapter";
import "@solana/wallet-adapter-react-ui/styles.css";

if (typeof window !== "undefined") {
  const bufferGlobal = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
  bufferGlobal.Buffer ??= Buffer;
}

const BURNER = process.env.NEXT_PUBLIC_BURNER === "1";
const MAX_BROWSER_TEST_WALLETS = 10;

interface BrowserTestWalletContextValue {
  adapters: TestWalletAdapter[];
  ready: boolean;
  createWallet(): TestWalletAdapter;
}

const BrowserTestWalletContext = createContext<BrowserTestWalletContextValue | null>(null);

export function useBrowserTestWallets() {
  const context = useContext(BrowserTestWalletContext);
  if (!context) throw new Error("useBrowserTestWallets must be used inside Providers.");
  return context;
}

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
  const [testWallets, setTestWallets] = useState<StoredTestWallet[]>([]);
  const [walletsReady, setWalletsReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTestWallets(loadTestWallets());
      setWalletsReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const adapters = useMemo(
    () => testWallets.map((wallet) => new TestWalletAdapter(wallet)),
    [testWallets],
  );
  // Phantom is auto-detected through wallet-standard; test and CI burners are local adapters.
  const wallets = useMemo(
    () => [...(BURNER ? [new BurnerWalletAdapter()] : []), ...adapters],
    [adapters],
  );
  const createWallet = useCallback(() => {
    if (!walletsReady) throw new Error("Test wallets are still loading.");
    if (testWallets.length >= MAX_BROWSER_TEST_WALLETS)
      throw new Error(`You can create up to ${MAX_BROWSER_TEST_WALLETS} browser test wallets.`);
    const name = `Test wallet ${testWallets.length + 1}`;
    const created = generateTestWallet(name);
    const next = [...testWallets, created];
    saveTestWallets(next);
    setTestWallets(next);
    return new TestWalletAdapter(created);
  }, [testWallets, walletsReady]);
  const contextValue = useMemo(
    () => ({ adapters, ready: walletsReady, createWallet }),
    [adapters, walletsReady, createWallet],
  );

  return (
    <BrowserTestWalletContext.Provider value={contextValue}>
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <AutoSelectBurner />
            {children}
            <Toaster richColors position="bottom-right" />
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </BrowserTestWalletContext.Provider>
  );
}
