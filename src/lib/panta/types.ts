/**
 * Panta API response types.
 *
 * Mirrors https://docs.panta.market/ exactly. Fields the docs mark as
 * `string | null` stay nullable here, the UI must render an honest
 * "unavailable" state rather than substituting a value.
 */

export type MarketPhase = "primary" | "secondary" | "resolved" | "cancelled";
export type MarketSide = "yes" | "no";
export type MarketType = "standard" | "breaking";

/** Catalog row. `yesPrice`/`noPrice` are null on list, populated on detail. */
export type PantaMarket = {
  marketId: string;
  category: string;
  title: string;
  description?: string | null;
  images?: string[] | null;
  phase: MarketPhase;
  marketType?: MarketType | null;
  /**
   * Documented as integer Unix seconds, but the live catalog returns ISO-8601
   * strings (verified against production). Both forms are accepted by
   * `unixToDate` in lib/utils/time. Note the asymmetry: market CREATION still
   * sends integer Unix seconds, which is what the create endpoint accepts.
   */
  startTime?: number | string | null;
  endTime?: number | string | null;
  resolutionTime?: number | string | null;
  region?: string | null;
  resolved?: boolean | null;
  status?: string | null;
  /** Human-readable decimal USDC string, e.g. "1200.00". */
  volumeUsdc?: string | null;
  totalVolumeUsdc?: string | null;
  campaignId?: string | null;
  createdByPartner?: boolean | null;
  yesPrice?: string | null;
  noPrice?: string | null;
  primaryYesPrice?: string | null;
  primaryNoPrice?: string | null;
  secondaryYesPrice?: string | null;
  secondaryNoPrice?: string | null;
  /** Present on some catalog rows; not guaranteed by the docs. */
  creatorAddress?: string | null;
  oracle?: string | null;
  outcome?: string | null;
};

export type PantaMarketsList = {
  items: PantaMarket[];
  nextCursor?: string | null;
};

export type PantaCategories = { categories: string[] };

/**
 * Catalog trade tape row.
 *
 * `yesAmount` / `noAmount` / `feePaid` are 1e6 base units (confirmed against
 * the official playground's `formatShareBase`). There is no USDC-spent field,
 * so a per-trade execution price cannot be derived from this row.
 */
export type PantaCatalogTrade = {
  id?: string | number;
  marketId?: string;
  wallet?: string;
  isPrimary?: boolean;
  yesAmount?: string | number | null;
  noAmount?: string | number | null;
  feePaid?: string | number | null;
  blockTime?: number | null;
  signature?: string;
  quoteAsset?: string;
};

export type PantaMarketTrades = { marketId: string; items: PantaCatalogTrade[] };
export type PantaWalletTrades = { wallet: string; items: PantaCatalogTrade[] };

export type PantaPosition = {
  marketId: string;
  category?: string | null;
  side: MarketSide;
  /** Human-readable share quantity. */
  shares: string;
  phase: MarketPhase;
  claimable: boolean;
  claimed: boolean;
  outcome?: string | null;
};

export type PantaPositions = { wallet: string; positions: PantaPosition[] };

export type PantaInstructionAccount = {
  pubkey: string;
  isSigner: boolean;
  isWritable: boolean;
};

export type PantaInstruction = {
  programId: string;
  /** base64 */
  data: string;
  accounts: PantaInstructionAccount[];
};

export type PantaPrimaryQuote = {
  quoteId: string;
  marketId: string;
  side: MarketSide;
  amountUsdc: string;
  shares: string;
  avgPrice: string;
  feeUsdc: string;
  expiresAt: string;
  blockhashExpiryHintSec?: number;
};

export type PantaPrimaryBuild = {
  orderId: string;
  quoteId: string;
  wallet: string;
  marketId: string;
  side: MarketSide;
  amountUsdc: string;
  expectedShares: string;
  feeUsdc: string;
  status: string;
  instructions: PantaInstruction[];
  derived?: Record<string, string>;
  recentBlockhash: string;
  lastValidBlockHeight?: number;
  expiresAt?: string;
  blockhashExpiryHintSec?: number;
};

export type PantaOrderStatus = "built" | "submitted" | "confirmed" | "failed" | "expired";

export type PantaPrimarySubmit = {
  orderId: string;
  status: PantaOrderStatus;
  signature?: string;
};

export type PantaPrimaryVerify = {
  orderId: string;
  status: PantaOrderStatus;
  signature?: string;
  marketId?: string;
  side?: MarketSide;
  amountUsdc?: string | number;
};

export type PantaWinClaimBuild = {
  wallet: string;
  marketId: string;
  outcome: string;
  winningShares: string;
  instructions: PantaInstruction[];
  derived?: Record<string, string>;
  recentBlockhash: string;
  lastValidBlockHeight?: number;
};

export type PantaCreatorFeesBuild = {
  wallet: string;
  marketId: string;
  /** USDC base units (6 decimals), e.g. "2500000" = 2.50 USDC. */
  claimableFeesUsdc: string;
  instructions: PantaInstruction[];
  derived?: Record<string, string>;
  recentBlockhash: string;
  lastValidBlockHeight?: number;
};

export type PantaTradeReport = {
  signature: string;
  status: string;
  marketId?: string;
  wallet?: string;
  side?: MarketSide;
  kind?: "buy" | "claim";
};

export type PantaTradeStatus = {
  signature: string;
  status: "processed" | "pending_attribution" | "unknown" | "failed";
  marketId?: string;
  wallet?: string;
};

export type PantaCreateQuote = {
  createId: string;
  expectedEventPda: string;
  /** USDC base units (6 decimals). */
  paymentUsdc: string;
  liquidityInjectionUsdc?: string;
  platformRevenueUsdc?: string;
  marketType: string;
  expiresAt: string;
  blockhashExpiryHintSec?: number;
};

export type PantaCreateBuild = {
  createId: string;
  expectedEventPda: string;
  /** base64 unsigned VersionedTransaction */
  transaction: string;
  recentBlockhash: string;
  lastValidBlockHeight?: number;
  buildFingerprint?: string;
  paymentUsdc: string;
  marketType: string;
  derived?: Record<string, string>;
  expiresAt?: string;
  blockhashExpiryHintSec?: number;
};

export type PantaCreateRegister = {
  createId: string;
  marketId: string;
  status: string;
  signature: string;
  category?: string;
  title?: string;
  images?: string[];
};

export type PantaImageUpload = {
  uploadUrl: string;
  publicId: string;
  expiresAt: string;
  fields: Record<string, string | number | boolean>;
};
