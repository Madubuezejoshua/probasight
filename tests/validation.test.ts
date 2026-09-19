import { describe, expect, it } from "vitest";
import {
  claimBuildSchema,
  createMarketQuoteSchema,
  listMarketsQuerySchema,
  marketIdSchema,
  sideSchema,
  signatureSchema,
  tradeQuoteSchema,
  usdcAmountSchema,
  walletSchema,
  zodFieldErrors,
} from "@/lib/validation/schemas";

const WALLET = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
const MARKET = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
const SIGNATURE =
  "5VEJv1RmVtcPvPkXBfmHVPyiQJCSNSNAX4PKPGtUw8RwCvMPWiVNtbeRLMeZCiBwPvKr5oFLdXnq2WLPYRbpGKKe";

describe("primitive schemas", () => {
  it("accepts valid base58 wallets and market ids", () => {
    expect(walletSchema.safeParse(WALLET).success).toBe(true);
    expect(marketIdSchema.safeParse(MARKET).success).toBe(true);
  });

  it("rejects non-base58 and wrong-length values", () => {
    // 0, O, I and l are not in the base58 alphabet.
    expect(walletSchema.safeParse("0OIl0OIl0OIl0OIl0OIl0OIl0OIl0OIl").success).toBe(false);
    expect(walletSchema.safeParse("tooshort").success).toBe(false);
    expect(walletSchema.safeParse("").success).toBe(false);
    expect(walletSchema.safeParse("../../etc/passwd").success).toBe(false);
  });

  it("validates transaction signatures by shape", () => {
    expect(signatureSchema.safeParse(SIGNATURE).success).toBe(true);
    expect(signatureSchema.safeParse("abc").success).toBe(false);
  });

  it("normalises side case-insensitively", () => {
    expect(sideSchema.parse("YES")).toBe("yes");
    expect(sideSchema.parse("No")).toBe("no");
    expect(sideSchema.safeParse("maybe").success).toBe(false);
  });
});

describe("usdcAmountSchema", () => {
  it("accepts positive decimals within USDC precision", () => {
    expect(usdcAmountSchema.parse("20")).toBe("20");
    expect(usdcAmountSchema.parse("20.50")).toBe("20.50");
    expect(usdcAmountSchema.parse(5)).toBe("5");
    expect(usdcAmountSchema.parse("0.000001")).toBe("0.000001");
  });

  it("rejects zero, negatives, junk and excess precision", () => {
    expect(usdcAmountSchema.safeParse("0").success).toBe(false);
    expect(usdcAmountSchema.safeParse("-5").success).toBe(false);
    expect(usdcAmountSchema.safeParse("abc").success).toBe(false);
    expect(usdcAmountSchema.safeParse("1e9").success).toBe(false);
    expect(usdcAmountSchema.safeParse("0.0000001").success).toBe(false);
    expect(usdcAmountSchema.safeParse("Infinity").success).toBe(false);
  });

  it("rejects absurdly large amounts", () => {
    expect(usdcAmountSchema.safeParse("99999999").success).toBe(false);
  });
});

describe("tradeQuoteSchema", () => {
  it("accepts a well-formed quote request", () => {
    const result = tradeQuoteSchema.safeParse({
      wallet: WALLET,
      marketId: MARKET,
      side: "yes",
      amountUsdc: "20.00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a bad wallet and reports the field", () => {
    const result = tradeQuoteSchema.safeParse({
      wallet: "nope",
      marketId: MARKET,
      side: "yes",
      amountUsdc: "20.00",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(zodFieldErrors(result.error).wallet).toBeDefined();
  });
});

describe("claimBuildSchema", () => {
  it("requires both wallet and market", () => {
    expect(claimBuildSchema.safeParse({ wallet: WALLET, marketId: MARKET }).success).toBe(
      true,
    );
    expect(claimBuildSchema.safeParse({ wallet: WALLET }).success).toBe(false);
  });
});

describe("createMarketQuoteSchema", () => {
  const base = {
    wallet: WALLET,
    question: "Will BTC close above 150k on 2026-12-31?",
    resolutionRule:
      "Resolves YES if the CoinGecko BTC/USD daily close on 2026-12-31 UTC exceeds 150000.",
    sourcesOfTruth: ["https://www.coingecko.com"],
    category: "crypto",
    startTime: 1_900_000_000,
    endTime: 1_900_100_000,
    resolutionTime: 1_900_200_000,
    imageUrl: "https://cdn.example.com/market.png",
  };

  it("accepts a valid creation payload", () => {
    expect(createMarketQuoteSchema.safeParse(base).success).toBe(true);
  });

  it("enforces start < end <= resolution", () => {
    const badOrder = createMarketQuoteSchema.safeParse({
      ...base,
      startTime: base.endTime + 1,
    });
    expect(badOrder.success).toBe(false);

    const earlyResolution = createMarketQuoteSchema.safeParse({
      ...base,
      resolutionTime: base.endTime - 1,
    });
    expect(earlyResolution.success).toBe(false);
  });

  it("allows resolution exactly at the end time", () => {
    const result = createMarketQuoteSchema.safeParse({
      ...base,
      resolutionTime: base.endTime,
    });
    expect(result.success).toBe(true);
  });

  it("requires at least one source of truth", () => {
    expect(
      createMarketQuoteSchema.safeParse({ ...base, sourcesOfTruth: [] }).success,
    ).toBe(false);
  });

  it("requires a public http(s) image URL", () => {
    expect(createMarketQuoteSchema.safeParse({ ...base, imageUrl: "" }).success).toBe(
      false,
    );
    expect(
      createMarketQuoteSchema.safeParse({
        ...base,
        imageUrl: "data:image/png;base64,iVBORw0KGgo=",
      }).success,
    ).toBe(false);
    expect(
      createMarketQuoteSchema.safeParse({ ...base, imageUrl: "ftp://example.com/a.png" })
        .success,
    ).toBe(false);
  });

  it("only allows eventInProgress on breaking markets", () => {
    expect(
      createMarketQuoteSchema.safeParse({
        ...base,
        marketType: "standard",
        eventInProgress: true,
      }).success,
    ).toBe(false);

    expect(
      createMarketQuoteSchema.safeParse({
        ...base,
        marketType: "breaking",
        eventInProgress: true,
      }).success,
    ).toBe(true);
  });

  it("enforces the documented length limits", () => {
    expect(
      createMarketQuoteSchema.safeParse({ ...base, question: "short" }).success,
    ).toBe(false);
    expect(
      createMarketQuoteSchema.safeParse({ ...base, question: "x".repeat(600) }).success,
    ).toBe(false);
    expect(
      createMarketQuoteSchema.safeParse({
        ...base,
        sourcesOfTruth: Array.from({ length: 25 }, () => "https://example.com"),
      }).success,
    ).toBe(false);
  });
});

describe("listMarketsQuerySchema", () => {
  it("accepts documented filters only", () => {
    expect(listMarketsQuerySchema.safeParse({ status: "primary" }).success).toBe(true);
    expect(listMarketsQuerySchema.safeParse({ status: "open" }).success).toBe(false);
    expect(listMarketsQuerySchema.safeParse({ createdBy: "me" }).success).toBe(true);
    expect(listMarketsQuerySchema.safeParse({ createdBy: "someone" }).success).toBe(false);
  });

  it("coerces and bounds the page size to Panta's maximum of 50", () => {
    expect(listMarketsQuerySchema.parse({ limit: "20" }).limit).toBe(20);
    expect(listMarketsQuerySchema.safeParse({ limit: "500" }).success).toBe(false);
    expect(listMarketsQuerySchema.safeParse({ limit: "0" }).success).toBe(false);
  });
});
