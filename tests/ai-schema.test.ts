import { describe, expect, it } from "vitest";
import { extractJsonObject, parseMarketAnalysis } from "@/lib/ai/schema";

const VALID = {
  summary: "This market asks whether X happens by a date.",
  currentMarketView: "YES trades at 0.62 USDC per share.",
  activityAnalysis: "Nine trades from six wallets, YES-weighted.",
  yesCase: ["Pricing leans YES.", "Share flow favours YES."],
  noCase: ["Resolution window is long.", "NO retains meaningful pricing."],
  keyUncertainties: ["The underlying event is not observable from this data."],
  dataLimitations: ["No USDC amounts on trade rows.", "No external information."],
};

describe("extractJsonObject", () => {
  it("returns a bare JSON object unchanged", () => {
    expect(extractJsonObject('{"a":1}')).toBe('{"a":1}');
  });

  it("strips markdown fences the model may add despite instructions", () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}');
    expect(extractJsonObject('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it("recovers an object wrapped in prose", () => {
    expect(extractJsonObject('Here you go: {"a":1} hope that helps')).toBe('{"a":1}');
  });

  it("returns null when there is no object at all", () => {
    expect(extractJsonObject("no json here")).toBeNull();
    expect(extractJsonObject("")).toBeNull();
    expect(extractJsonObject("}{")).toBeNull();
  });
});

describe("parseMarketAnalysis", () => {
  it("accepts a well-formed analysis", () => {
    const result = parseMarketAnalysis(JSON.stringify(VALID));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.summary).toBe(VALID.summary);
      expect(result.value.yesCase).toHaveLength(2);
    }
  });

  it("accepts a fenced analysis", () => {
    const result = parseMarketAnalysis("```json\n" + JSON.stringify(VALID) + "\n```");
    expect(result.ok).toBe(true);
  });

  it("rejects a missing section rather than rendering a partial analysis", () => {
    const { activityAnalysis: _omitted, ...missing } = VALID;
    void _omitted;
    const result = parseMarketAnalysis(JSON.stringify(missing));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("schema");
  });

  it("rejects empty arrays, which would render as blank sections", () => {
    const result = parseMarketAnalysis(JSON.stringify({ ...VALID, yesCase: [] }));
    expect(result.ok).toBe(false);
  });

  it("rejects empty strings", () => {
    const result = parseMarketAnalysis(JSON.stringify({ ...VALID, summary: "   " }));
    expect(result.ok).toBe(false);
  });

  it("rejects malformed JSON", () => {
    const result = parseMarketAnalysis("{not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/JSON/i);
  });

  it("rejects a non-object payload", () => {
    const result = parseMarketAnalysis("[1,2,3]");
    expect(result.ok).toBe(false);
  });

  it("rejects wrong types in the bullet arrays", () => {
    const result = parseMarketAnalysis(
      JSON.stringify({ ...VALID, noCase: [{ point: "structured" }] }),
    );
    expect(result.ok).toBe(false);
  });

  it("caps bullet counts so one section cannot flood the panel", () => {
    const result = parseMarketAnalysis(
      JSON.stringify({ ...VALID, yesCase: Array.from({ length: 12 }, (_, i) => `p${i}`) }),
    );
    expect(result.ok).toBe(false);
  });
});
