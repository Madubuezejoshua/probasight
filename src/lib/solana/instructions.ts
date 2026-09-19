"use client";

import { Buffer } from "buffer";
import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import type { PantaInstruction } from "@/lib/panta/types";

// Several wallet adapters and web3.js paths still expect a global Buffer.
if (typeof window !== "undefined") {
  const w = window as unknown as { Buffer?: typeof Buffer };
  if (!w.Buffer) w.Buffer = Buffer;
}

/**
 * Converts Panta's instruction payloads into web3.js instructions.
 *
 * Panta returns `{ programId, data (base64), accounts: [{pubkey, isSigner,
 * isWritable}] }`. This mirrors the official playground's
 * `instructionsToVersionedTx` so the wire format stays authoritative.
 */
export function toTransactionInstructions(
  instructions: PantaInstruction[],
): TransactionInstruction[] {
  if (!Array.isArray(instructions) || instructions.length === 0) {
    throw new Error("Panta returned no instructions to sign");
  }
  return instructions.map(
    (ix) =>
      new TransactionInstruction({
        programId: new PublicKey(ix.programId),
        keys: ix.accounts.map((account) => ({
          pubkey: new PublicKey(account.pubkey),
          isSigner: account.isSigner,
          isWritable: account.isWritable,
        })),
        // web3.js types want Buffer; the runtime accepts Uint8Array.
        data: Buffer.from(ix.data, "base64") as unknown as Buffer,
      }),
  );
}

/**
 * Compiles Panta instructions plus a Panta-provided blockhash into an unsigned
 * v0 transaction. Used by primary buy, win claim and creator-fee claim.
 */
export function instructionsToVersionedTransaction(
  instructions: PantaInstruction[],
  feePayer: PublicKey,
  recentBlockhash: string,
): VersionedTransaction {
  if (!recentBlockhash) {
    throw new Error("Panta build response did not include a recentBlockhash");
  }
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash,
    instructions: toTransactionInstructions(instructions),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/**
 * Deserialises a fully-assembled base64 VersionedTransaction.
 * Market creation returns this shape instead of an instruction list.
 */
export function deserializeVersionedTransaction(base64: string): VersionedTransaction {
  if (!base64) {
    throw new Error("Panta build response did not include a transaction");
  }
  return VersionedTransaction.deserialize(Buffer.from(base64, "base64"));
}
