/**
 * Central environment access.
 *
 * Server secrets are read lazily and never imported into client bundles —
 * `src/lib/panta/client.ts` and `src/lib/ai/groq.ts` are the only consumers
 * of the server half and both are marked `server-only`.
 */

export type MissingEnv = {
  name: string;
  purpose: string;
};

/** Public (browser-safe) configuration. Referenced literally so Next can inline it. */
export const publicEnv = {
  solanaRpcUrl:
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  solanaNetwork: (process.env.NEXT_PUBLIC_SOLANA_NETWORK || "mainnet-beta") as
    | "mainnet-beta"
    | "devnet"
    | "testnet",
} as const;

/** True when the deployer explicitly configured an RPC (public default is rate-limited). */
export const hasCustomRpc = Boolean(process.env.NEXT_PUBLIC_SOLANA_RPC_URL);

const DEFAULT_PANTA_BASE_URL = "https://live-api.panta.market/api/v1";

export function getPantaConfig() {
  const apiKey = process.env.PANTA_API_KEY?.trim();
  const baseUrl = (process.env.PANTA_API_BASE_URL?.trim() || DEFAULT_PANTA_BASE_URL).replace(
    /\/+$/,
    "",
  );
  return { apiKey, baseUrl, configured: Boolean(apiKey) };
}

/**
 * Groq configuration.
 *
 * The default model is verified against Groq's live model list and must support
 * JSON mode. Deliberately NOT a `groq/compound*` model: those have web search
 * built in, which would break this product's core guarantee that the analysis
 * is grounded only in the Panta snapshot it is given.
 */
export function getGroqConfig() {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-120b";
  return { apiKey, model, configured: Boolean(apiKey) };
}

/** Used by the diagnostics surface so operators can see what is still missing. */
export function missingServerEnv(): MissingEnv[] {
  const missing: MissingEnv[] = [];
  if (!getPantaConfig().apiKey) {
    missing.push({
      name: "PANTA_API_KEY",
      purpose: "All Panta market, trading, position, claim and creation calls",
    });
  }
  if (!getGroqConfig().apiKey) {
    missing.push({
      name: "GROQ_API_KEY",
      purpose: "AI Market Intelligence analysis",
    });
  }
  return missing;
}

export const SOLANA_EXPLORER_CLUSTER_SUFFIX =
  publicEnv.solanaNetwork === "mainnet-beta" ? "" : `?cluster=${publicEnv.solanaNetwork}`;

export function explorerTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}${SOLANA_EXPLORER_CLUSTER_SUFFIX}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://solscan.io/account/${address}${SOLANA_EXPLORER_CLUSTER_SUFFIX}`;
}
