"use client";

import type { Connection, VersionedTransaction } from "@solana/web3.js";
import { AppError } from "@/lib/panta/errors";

export type SignFunction = <T extends VersionedTransaction>(transaction: T) => Promise<T>;

/**
 * Classifies a thrown wallet/RPC error into a distinct application code so the
 * UI can tell "you declined" apart from "the network failed". Wallet adapters
 * do not share one error type, so this matches on the documented shapes.
 */
export function classifySigningError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const message = err instanceof Error ? err.message : String(err ?? "");
  const lower = message.toLowerCase();
  const name = err instanceof Error ? err.name : "";
  const code = (err as { code?: unknown })?.code;

  // Phantom/Solflare user rejection: code 4001 or an explicit reject message.
  const rejected =
    code === 4001 ||
    name === "WalletSignTransactionError" ||
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("transaction was not approved") ||
    lower.includes("declined");

  if (rejected) {
    return new AppError({
      code: "WALLET_REJECTED",
      message: "You declined the signature request in your wallet.",
      retryable: false,
      status: 400,
    });
  }

  if (lower.includes("blockhash not found") || lower.includes("block height exceeded")) {
    return new AppError({
      code: "BLOCKHASH_EXPIRED",
      message:
        "The transaction blockhash expired before it landed. A fresh quote and build are required.",
      retryable: true,
      status: 409,
    });
  }

  if (lower.includes("insufficient") && (lower.includes("funds") || lower.includes("lamports"))) {
    return new AppError({
      code: "INSUFFICIENT_FUNDS",
      message:
        "The wallet does not hold enough USDC (or SOL for fees) to complete this transaction.",
      retryable: false,
      status: 400,
    });
  }

  if (lower.includes("timeout") || lower.includes("timed out")) {
    return new AppError({
      code: "RPC_TIMEOUT",
      message:
        "The Solana RPC did not confirm in time. The transaction may still land — check the signature before retrying.",
      retryable: true,
      status: 504,
    });
  }

  if (lower.includes("simulation failed") || lower.includes("custom program error")) {
    return new AppError({
      code: "TX_REVERTED",
      message: `The transaction failed on-chain. ${message}`.trim(),
      retryable: false,
      status: 400,
    });
  }

  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return new AppError({
      code: "RPC_REJECTED",
      message: "The Solana RPC could not be reached. Check the configured RPC endpoint.",
      retryable: true,
      status: 502,
    });
  }

  return new AppError({
    code: "RPC_REJECTED",
    message: message || "The wallet or RPC rejected the transaction.",
    retryable: true,
    status: 502,
  });
}

/**
 * Requests exactly one wallet signature, then broadcasts.
 *
 * There is never a silent retry of a signing prompt: a failure here surfaces to
 * the caller so the user explicitly re-approves.
 */
export async function signAndBroadcast(input: {
  connection: Connection;
  transaction: VersionedTransaction;
  signTransaction: SignFunction;
  onSigned?: () => void;
}): Promise<string> {
  let signed: VersionedTransaction;
  try {
    signed = await input.signTransaction(input.transaction);
  } catch (err) {
    throw classifySigningError(err);
  }

  input.onSigned?.();

  try {
    return await input.connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
      maxRetries: 3,
    });
  } catch (err) {
    throw classifySigningError(err);
  }
}

/**
 * Waits for on-chain confirmation using the Panta-provided lastValidBlockHeight
 * when available. Returns normally on success and throws a classified AppError
 * on failure, so callers never report success before the chain agrees.
 */
export async function confirmTransaction(input: {
  connection: Connection;
  signature: string;
  blockhash: string;
  lastValidBlockHeight?: number;
}): Promise<void> {
  const { connection, signature, blockhash, lastValidBlockHeight } = input;
  try {
    const lastValid =
      lastValidBlockHeight ?? (await connection.getBlockHeight("confirmed")) + 150;

    const result = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight: lastValid },
      "confirmed",
    );

    if (result.value.err) {
      throw new AppError({
        code: "TX_REVERTED",
        message: "The transaction was processed but failed on-chain.",
        details: { err: JSON.stringify(result.value.err) },
        retryable: false,
        status: 400,
      });
    }
  } catch (err) {
    throw classifySigningError(err);
  }
}
