import { describe, expect, it } from "vitest";
import { Keypair, PublicKey, VersionedTransaction } from "@solana/web3.js";
import {
  deserializeVersionedTransaction,
  instructionsToVersionedTransaction,
  toTransactionInstructions,
} from "@/lib/solana/instructions";
import { classifySigningError } from "@/lib/solana/broadcast";
import type { PantaInstruction } from "@/lib/panta/types";

const feePayer = Keypair.generate().publicKey;
const programId = new PublicKey("11111111111111111111111111111111");
const accountA = Keypair.generate().publicKey;

// A Panta-shaped build response: base64 data plus explicit account metadata.
const instruction: PantaInstruction = {
  programId: programId.toBase58(),
  data: Buffer.from([1, 2, 3, 4]).toString("base64"),
  accounts: [
    { pubkey: feePayer.toBase58(), isSigner: true, isWritable: true },
    { pubkey: accountA.toBase58(), isSigner: false, isWritable: true },
  ],
};

// A real blockhash is just a base58 32-byte value.
const BLOCKHASH = Keypair.generate().publicKey.toBase58();

describe("toTransactionInstructions", () => {
  it("decodes base64 data and preserves account metadata", () => {
    const [ix] = toTransactionInstructions([instruction]);
    expect(ix.programId.toBase58()).toBe(programId.toBase58());
    expect(Array.from(ix.data)).toEqual([1, 2, 3, 4]);
    expect(ix.keys).toHaveLength(2);
    expect(ix.keys[0].isSigner).toBe(true);
    expect(ix.keys[0].isWritable).toBe(true);
    expect(ix.keys[1].isSigner).toBe(false);
    expect(ix.keys[1].pubkey.toBase58()).toBe(accountA.toBase58());
  });

  it("preserves instruction order, which Panta declares significant", () => {
    const second: PantaInstruction = {
      ...instruction,
      data: Buffer.from([9]).toString("base64"),
    };
    const result = toTransactionInstructions([instruction, second]);
    expect(Array.from(result[0].data)).toEqual([1, 2, 3, 4]);
    expect(Array.from(result[1].data)).toEqual([9]);
  });

  it("refuses an empty instruction list rather than signing nothing", () => {
    expect(() => toTransactionInstructions([])).toThrow(/no instructions/i);
  });

  it("throws on an invalid pubkey instead of producing a corrupt transaction", () => {
    expect(() =>
      toTransactionInstructions([
        { ...instruction, accounts: [{ pubkey: "not-a-key", isSigner: true, isWritable: true }] },
      ]),
    ).toThrow();
  });
});

describe("instructionsToVersionedTransaction", () => {
  it("compiles a v0 transaction with the Panta-provided blockhash", () => {
    const tx = instructionsToVersionedTransaction([instruction], feePayer, BLOCKHASH);
    expect(tx).toBeInstanceOf(VersionedTransaction);
    expect(tx.message.recentBlockhash).toBe(BLOCKHASH);
    expect(tx.message.version).toBe(0);
  });

  it("puts the wallet first in the account keys, making it the fee payer", () => {
    const tx = instructionsToVersionedTransaction([instruction], feePayer, BLOCKHASH);
    expect(tx.message.staticAccountKeys[0].toBase58()).toBe(feePayer.toBase58());
  });

  it("produces a transaction that survives a serialise/deserialise round trip", () => {
    const tx = instructionsToVersionedTransaction([instruction], feePayer, BLOCKHASH);
    const restored = VersionedTransaction.deserialize(tx.serialize());
    expect(restored.message.recentBlockhash).toBe(BLOCKHASH);
    expect(restored.message.staticAccountKeys[0].toBase58()).toBe(feePayer.toBase58());
  });

  it("refuses to compile without a blockhash", () => {
    expect(() => instructionsToVersionedTransaction([instruction], feePayer, "")).toThrow(
      /recentBlockhash/i,
    );
  });
});

describe("deserializeVersionedTransaction", () => {
  it("round-trips the base64 transaction shape used by market creation", () => {
    const tx = instructionsToVersionedTransaction([instruction], feePayer, BLOCKHASH);
    const base64 = Buffer.from(tx.serialize()).toString("base64");
    const restored = deserializeVersionedTransaction(base64);
    expect(restored.message.recentBlockhash).toBe(BLOCKHASH);
  });

  it("refuses an empty payload", () => {
    expect(() => deserializeVersionedTransaction("")).toThrow(/transaction/i);
  });
});


describe("classifySigningError", () => {
  it("identifies an explicit user rejection", () => {
    // Phantom and Solflare surface rejection differently; both must be caught.
    expect(classifySigningError({ code: 4001 }).code).toBe("WALLET_REJECTED");
    expect(classifySigningError(new Error("User rejected the request.")).code).toBe(
      "WALLET_REJECTED",
    );
    expect(classifySigningError(new Error("User denied transaction signature")).code).toBe(
      "WALLET_REJECTED",
    );

    const adapterError = new Error("Transaction was not approved");
    adapterError.name = "WalletSignTransactionError";
    expect(classifySigningError(adapterError).code).toBe("WALLET_REJECTED");
  });

  it("never marks a user rejection retryable", () => {
    expect(classifySigningError({ code: 4001 }).retryable).toBe(false);
  });

  it("identifies an expired blockhash so the caller rebuilds", () => {
    expect(classifySigningError(new Error("Blockhash not found")).code).toBe(
      "BLOCKHASH_EXPIRED",
    );
    expect(
      classifySigningError(new Error("block height exceeded for this transaction")).code,
    ).toBe("BLOCKHASH_EXPIRED");
  });

  it("separates insufficient funds from generic RPC failure", () => {
    expect(
      classifySigningError(new Error("Insufficient funds for transaction")).code,
    ).toBe("INSUFFICIENT_FUNDS");
  });

  it("identifies on-chain failure distinctly from a network problem", () => {
    expect(classifySigningError(new Error("Transaction simulation failed")).code).toBe(
      "TX_REVERTED",
    );
    expect(classifySigningError(new Error("custom program error: 0x1")).code).toBe(
      "TX_REVERTED",
    );
    expect(classifySigningError(new Error("Request timed out")).code).toBe("RPC_TIMEOUT");
    expect(classifySigningError(new Error("Failed to fetch")).code).toBe("RPC_REJECTED");
  });

  it("falls back to a retryable RPC error for anything unrecognised", () => {
    const error = classifySigningError(new Error("something unusual"));
    expect(error.code).toBe("RPC_REJECTED");
    expect(error.retryable).toBe(true);
  });
});
