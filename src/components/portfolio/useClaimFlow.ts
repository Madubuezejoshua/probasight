"use client";

import { useCallback, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { apiFetch, toErrorShape, type ApiErrorShape } from "@/lib/client-api";
import { instructionsToVersionedTransaction } from "@/lib/solana/instructions";
import { confirmTransaction, signAndBroadcast } from "@/lib/solana/broadcast";
import type { PantaCreatorFeesBuild, PantaWinClaimBuild } from "@/lib/panta/types";

/**
 * Claim lifecycle for both claim types.
 *
 * Win claim:     build -> sign -> broadcast -> confirm -> report to /trades/
 * Creator fees:  build -> sign -> broadcast -> confirm            (no report)
 *
 * The asymmetry is deliberate and follows Panta's docs: creator-fee signatures
 * are rejected by the attribution endpoint with TX_MISMATCH, so this flow must
 * not force both through one reporting path.
 */

export type ClaimKind = "winnings" | "creator-fees";

export type ClaimStage =
  | "idle"
  | "building"
  | "awaiting-wallet"
  | "broadcasting"
  | "confirming"
  | "reporting"
  | "completed"
  | "error";

export const CLAIM_STAGE_LABELS: Record<ClaimStage, string> = {
  idle: "",
  building: "Building claim…",
  "awaiting-wallet": "Waiting for wallet approval…",
  broadcasting: "Sending to Solana…",
  confirming: "Confirming transaction…",
  reporting: "Reporting to Panta…",
  completed: "Claimed",
  error: "",
};

export type ClaimResult = {
  marketId: string;
  kind: ClaimKind;
  signature: string;
  amountLabel: string;
  attributionStatus: string | null;
  warning: string | null;
};

export function useClaimFlow() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [stage, setStage] = useState<ClaimStage>("idle");
  const [activeMarketId, setActiveMarketId] = useState<string | null>(null);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const running = useRef(false);

  const reset = useCallback(() => {
    setStage("idle");
    setActiveMarketId(null);
    setError(null);
    setResult(null);
    running.current = false;
  }, []);

  const claim = useCallback(
    async (marketId: string, kind: ClaimKind) => {
      if (running.current) return;
      if (!publicKey || !connected || !signTransaction) {
        setError({
          code: "WALLET_NOT_CONNECTED",
          message: "Connect a Solana wallet to claim.",
          retryable: false,
        });
        setStage("error");
        return;
      }

      running.current = true;
      setActiveMarketId(marketId);
      setError(null);
      setResult(null);

      const wallet = publicKey.toBase58();
      const endpoint =
        kind === "winnings"
          ? "/api/panta/claims/winnings/build"
          : "/api/panta/claims/creator-fees/build";

      let build: PantaWinClaimBuild | PantaCreatorFeesBuild;
      try {
        setStage("building");
        build = await apiFetch<PantaWinClaimBuild | PantaCreatorFeesBuild>(endpoint, {
          method: "POST",
          body: { wallet, marketId },
        });
      } catch (err) {
        setError(toErrorShape(err));
        setStage("error");
        running.current = false;
        return;
      }

      let signature: string;
      try {
        setStage("awaiting-wallet");
        const transaction = instructionsToVersionedTransaction(
          build.instructions,
          publicKey,
          build.recentBlockhash,
        );
        signature = await signAndBroadcast({
          connection,
          transaction,
          signTransaction,
          onSigned: () => setStage("broadcasting"),
        });
      } catch (err) {
        setError(toErrorShape(err));
        setStage("error");
        running.current = false;
        return;
      }

      let warning: string | null = null;
      try {
        setStage("confirming");
        await confirmTransaction({
          connection,
          signature,
          blockhash: build.recentBlockhash,
          lastValidBlockHeight: build.lastValidBlockHeight,
        });
      } catch (err) {
        const shape = toErrorShape(err);
        if (shape.code === "TX_REVERTED") {
          setError(shape);
          setStage("error");
          running.current = false;
          return;
        }
        warning = `Confirmation could not be verified from this client (${shape.code}). The signature is recorded below.`;
      }

      // Win claims are attributable; creator-fee claims are explicitly not.
      let attributionStatus: string | null = null;
      if (kind === "winnings") {
        try {
          setStage("reporting");
          const reported = await apiFetch<{ status?: string }>(
            "/api/panta/trades/report",
            { method: "POST", body: { signature, wallet, marketId } },
          );
          attributionStatus = reported.status ?? null;
        } catch (err) {
          const shape = toErrorShape(err);
          attributionStatus =
            shape.code === "TX_NOT_FOUND" ? "pending_attribution" : null;
        }
      }

      const amountLabel =
        "winningShares" in build
          ? `${build.winningShares} winning shares`
          : `${build.claimableFeesUsdc} USDC base units`;

      setResult({ marketId, kind, signature, amountLabel, attributionStatus, warning });
      setStage("completed");
      running.current = false;
    },
    [publicKey, connected, signTransaction, connection],
  );

  return { stage, activeMarketId, error, result, claim, reset };
}
