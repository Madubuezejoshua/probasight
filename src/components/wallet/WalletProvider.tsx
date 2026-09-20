"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { publicEnv } from "@/lib/env";

import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Non-custodial wallet context.
 *
 * Keys never leave the wallet: this app only ever receives a public key and a
 * signed transaction. `autoConnect` is enabled so a previously authorised
 * wallet reconnects, which is a connection, not a signing approval, every
 * transaction still requires an explicit in-wallet confirmation.
 */
export function SolanaWalletProvider({ children }: { children: React.ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider
      endpoint={publicEnv.solanaRpcUrl}
      config={{ commitment: "confirmed" }}
    >
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
