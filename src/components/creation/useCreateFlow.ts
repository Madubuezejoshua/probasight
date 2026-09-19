"use client";

import { useCallback, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { apiFetch, toErrorShape, type ApiErrorShape } from "@/lib/client-api";
import { REBUILD_CODES } from "@/lib/panta/errors";
import { deserializeVersionedTransaction } from "@/lib/solana/instructions";
import { confirmTransaction, signAndBroadcast } from "@/lib/solana/broadcast";
import type {
  PantaCreateBuild,
  PantaCreateQuote,
  PantaCreateRegister,
} from "@/lib/panta/types";
import type { CreateMarketQuoteInput } from "@/lib/panta/create-market";

/**
 * Market creation lifecycle.
 *
 * quote (createId, ~5 min) -> build (base64 tx, blockhash ~60s)
 *   -> wallet sign -> broadcast -> confirm -> register
 *
 * Build is re-run immediately before signing so the blockhash is as fresh as
 * possible, and an expired session is surfaced as a re-quote rather than being
 * silently retried with stale transaction data.
 */

export type CreateStage =
  | "idle"
  | "quoting"
  | "quoted"
  | "building"
  | "awaiting-wallet"
  | "broadcasting"
  | "confirming"
  | "registering"
  | "completed"
  | "error";

export const CREATE_STAGE_LABELS: Record<CreateStage, string> = {
  idle: "",
  quoting: "Requesting creation quote…",
  quoted: "Quote ready",
  building: "Building transaction…",
  "awaiting-wallet": "Waiting for wallet approval…",
  broadcasting: "Sending to Solana…",
  confirming: "Confirming transaction…",
  registering: "Registering market with Panta…",
  completed: "Market created",
  error: "",
};

export type CreateResult = {
  marketId: string;
  title: string;
  signature: string;
  status: string;
};

export function useCreateFlow() {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [stage, setStage] = useState<CreateStage>("idle");
  const [quote, setQuote] = useState<PantaCreateQuote | null>(null);
  const [error, setError] = useState<ApiErrorShape | null>(null);
  const [result, setResult] = useState<CreateResult | null>(null);
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
    setStage("idle");
  }, []);

  /** Step 1: validate parameters and reserve a create session. */
  const requestQuote = useCallback(
    async (input: Omit<CreateMarketQuoteInput, "wallet">) => {
      if (!publicKey) {
        setError({
          code: "WALLET_NOT_CONNECTED",
          message: "Connect a Solana wallet to create a market.",
          retryable: false,
        });
        setStage("error");
        return null;
      }
      setStage("quoting");
      setError(null);
      try {
        const next = await apiFetch<PantaCreateQuote>("/api/panta/create/quote", {
          method: "POST",
          body: { ...input, wallet: publicKey.toBase58() },
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
    [publicKey],
  );

  /**
   * Steps 2-6. This is the only place that spends funds, and it runs strictly
   * from an explicit user action followed by an explicit in-wallet approval.
   */
  const signAndRegister = useCallback(
    async (activeQuote: PantaCreateQuote, title: string) => {
      if (running.current) return;
      if (!publicKey || !connected || !signTransaction) {
        setError({
          code: "WALLET_NOT_CONNECTED",
          message: "Connect a Solana wallet that can sign transactions.",
          retryable: false,
        });
        setStage("error");
        return;
      }

      running.current = true;
      setError(null);
      const wallet = publicKey.toBase58();

      let build: PantaCreateBuild;
      try {
        setStage("building");
        build = await apiFetch<PantaCreateBuild>("/api/panta/create/build", {
          method: "POST",
          body: { createId: activeQuote.createId, wallet },
        });
      } catch (err) {
        const shape = toErrorShape(err);
        setError(shape);
        setStage("error");
        // An expired create session must be re-quoted, never re-signed.
        if (REBUILD_CODES.has(shape.code)) setQuote(null);
        running.current = false;
        return;
      }

      let signature: string;
      try {
        setStage("awaiting-wallet");
        const transaction = deserializeVersionedTransaction(build.transaction);
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
        // Otherwise fall through: register is fail-closed and will tell us.
      }

      try {
        setStage("registering");
        const registered = await apiFetch<PantaCreateRegister>(
          "/api/panta/create/register",
          { method: "POST", body: { createId: activeQuote.createId, signature } },
        );
        setResult({
          marketId: registered.marketId,
          title: registered.title || title,
          signature,
          status: registered.status,
        });
        setStage("completed");
      } catch (err) {
        const shape = toErrorShape(err);
        setError({
          ...shape,
          message:
            shape.code === "TX_NOT_FOUND"
              ? `Panta has not observed the transaction yet. It was broadcast as ${signature} — retry registration in a moment.`
              : shape.message,
          details: { ...shape.details, signature },
        });
        setStage("error");
      } finally {
        running.current = false;
      }
    },
    [publicKey, connected, signTransaction, connection],
  );

  /** Retry registration for an already-broadcast create transaction. */
  const retryRegister = useCallback(
    async (createId: string, signature: string, title: string) => {
      setStage("registering");
      setError(null);
      try {
        const registered = await apiFetch<PantaCreateRegister>(
          "/api/panta/create/register",
          { method: "POST", body: { createId, signature } },
        );
        setResult({
          marketId: registered.marketId,
          title: registered.title || title,
          signature,
          status: registered.status,
        });
        setStage("completed");
      } catch (err) {
        setError(toErrorShape(err));
        setStage("error");
      }
    },
    [],
  );

  return {
    stage,
    quote,
    error,
    result,
    requestQuote,
    signAndRegister,
    retryRegister,
    reset,
    clearQuote,
  };
}
