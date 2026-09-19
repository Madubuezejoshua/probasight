"use client";

import { useCallback, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { apiFetch, toErrorShape, type ApiErrorShape } from "@/lib/client-api";
import { REBUILD_CODES } from "@/lib/panta/errors";
import { instructionsToVersionedTransaction } from "@/lib/solana/instructions";
import { confirmTransaction, signAndBroadcast } from "@/lib/solana/broadcast";
import type {
  MarketSide,
  PantaPrimaryBuild,
  PantaPrimaryQuote,
  PantaPrimaryVerify,
  PantaTradeReport,
} from "@/lib/panta/types";

/**
 * The Panta primary-buy lifecycle, as one state machine.
 *
 * quote -> build -> sign -> broadcast -> confirm -> submit -> report -> verify
 *
 * Success is only ever declared after Panta has acknowledged the signature.
 * A failure after broadcast is reported distinctly from a failure before it,
 * because in that case the user's funds have already moved.
 */

export type TradeStage =
  | "idle"
  | "quoting"
  | "quoted"
  | "building"
  | "awaiting-wallet"
  | "signed"
  | "broadcasting"
  | "confirming"
  | "submitting"
  | "reporting"
  | "verifying"
  | "completed"
  | "error";

export const STAGE_LABELS: Record<TradeStage, string> = {
  idle: "",
  quoting: "Getting quote…",
  quoted: "Quote ready",
  building: "Building transaction…",
  "awaiting-wallet": "Waiting for wallet approval…",
  signed: "Wallet signed",
  broadcasting: "Sending to Solana…",
  confirming: "Confirming transaction…",
  submitting: "Reporting to Panta…",
  reporting: "Attributing trade to Panta…",
  verifying: "Verifying with Panta…",
  completed: "Completed",
  error: "",
};

export type TradeResult = {
  signature: string;
  orderId: string;
  marketId: string;
  side: MarketSide;
  amountUsdc: string;
  expectedShares: string;
  pantaOrderStatus: string;
  attributionStatus: string | null;
  /** Set when the chain succeeded but a post-broadcast Panta step did not. */
  postBroadcastWarning: string | null;
};

export function useTradeFlow(marketId: string) {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [stage, setStage] = useState<TradeStage>("idle");
  const [quote, setQuote] = useState<PantaPrimaryQuote | null>(null);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [result, setResult] = useState<TradeResult | null>(null);

  // Guards against a double-submit from an impatient second click.
  const running = useRef(false);

  const reset = useCallback(() => {
    setStage("idle");
    setQuote(null);
    setError(null);
    setResult(null);
    running.current = false;
  }, []);

  const clearQuote = useCallback(() => {
    setQuote(null);
    setError(null);
    if (stage === "quoted") setStage("idle");
  }, [stage]);

  /** Step 1: price the fill. */
  const getQuote = useCallback(
    async (side: MarketSide, amountUsdc: string) => {
      if (!publicKey) {
        setError({
          code: "WALLET_NOT_CONNECTED",
          message: "Connect a Solana wallet to request a quote.",
          retryable: false,
        });
        return null;
      }
      setStage("quoting");
      setError(null);
      setResult(null);
      try {
        const next = await apiFetch<PantaPrimaryQuote>("/api/panta/trade/quote", {
          method: "POST",
          body: {
            wallet: publicKey.toBase58(),
            marketId,
            side,
            amountUsdc,
          },
        });
        setQuote(next);
        setStage("quoted");
        return next;
      } catch (err) {
        setError(toErrorShape(err));
        setStage("error");
        return null;
      }
    },
    [publicKey, marketId],
  );

  /** Steps 2-8: build, sign, broadcast, confirm, submit, report, verify. */
  const execute = useCallback(
    async (activeQuote: PantaPrimaryQuote, maxSlippageBps: number) => {
      if (running.current) return;
      if (!publicKey || !connected) {
        setError({
          code: "WALLET_NOT_CONNECTED",
          message: "Connect a Solana wallet to trade.",
          retryable: false,
        });
        setStage("error");
        return;
      }
      if (!signTransaction) {
        setError({
          code: "WALLET_CANNOT_SIGN",
          message: "This wallet cannot sign transactions in the browser.",
          retryable: false,
        });
        setStage("error");
        return;
      }

      running.current = true;
      setError(null);
      const wallet = publicKey.toBase58();

      let build: PantaPrimaryBuild;
      try {
        setStage("building");
        build = await apiFetch<PantaPrimaryBuild>("/api/panta/trade/build", {
          method: "POST",
          body: { quoteId: activeQuote.quoteId, wallet, maxSlippageBps },
        });
      } catch (err) {
        const shape = toErrorShape(err);
        setError(shape);
        setStage("error");
        // A stale or expired session must be discarded, never re-signed.
        if (REBUILD_CODES.has(shape.code)) setQuote(null);
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

      // From here the transaction exists on-chain. Anything that fails below is
      // a bookkeeping failure, not a lost trade, and is surfaced as such.
      let postBroadcastWarning: string | null = null;

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
        postBroadcastWarning = `Solana confirmation could not be verified from this client (${shape.code}). The signature is recorded below.`;
      }

      let orderStatus = "submitted";
      try {
        setStage("submitting");
        const submitted = await apiFetch<{ status: string }>("/api/panta/trade/submit", {
          method: "POST",
          body: { orderId: build.orderId, signature, wallet },
        });
        orderStatus = submitted.status ?? "submitted";
      } catch (err) {
        postBroadcastWarning =
          postBroadcastWarning ??
          `Panta did not accept the order submission (${toErrorShape(err).code}).`;
      }

      // Explicit attribution. This is the documented reporting path and is a
      // first-class step, not a side effect.
      let attributionStatus: string | null = null;
      try {
        setStage("reporting");
        const reported = await apiFetch<PantaTradeReport>("/api/panta/trades/report", {
          method: "POST",
          body: {
            signature,
            wallet,
            marketId,
            quoteId: activeQuote.quoteId,
          },
        });
        attributionStatus = reported.status ?? null;
      } catch (err) {
        const shape = toErrorShape(err);
        // TX_NOT_FOUND here just means Panta has not indexed it yet.
        attributionStatus = shape.code === "TX_NOT_FOUND" ? "pending_attribution" : null;
      }

      try {
        setStage("verifying");
        const verified = await apiFetch<PantaPrimaryVerify>("/api/panta/trade/verify", {
          method: "POST",
          body: { orderId: build.orderId, signature, wallet },
        });
        orderStatus = verified.status ?? orderStatus;
      } catch {
        // Verification is advisory; the signature remains the source of truth.
      }

      setResult({
        signature,
        orderId: build.orderId,
        marketId,
        side: build.side ?? activeQuote.side,
        amountUsdc: build.amountUsdc ?? activeQuote.amountUsdc,
        expectedShares: build.expectedShares ?? activeQuote.shares,
        pantaOrderStatus: orderStatus,
        attributionStatus,
        postBroadcastWarning,
      });
      setStage("completed");
      running.current = false;
    },
    [publicKey, connected, signTransaction, connection, marketId],
  );

  return { stage, quote, error, result, getQuote, execute, reset, clearQuote };
}
