import { describe, expect, it } from "vitest";
import { loadCorpus } from "./loadCorpus.js";
import { OnPremVectorStore } from "./vectorStore.js";

describe("benchmark corpus retrieval, end to end against the real data", () => {
  const store = new OnPremVectorStore(loadCorpus());

  it("returns only autonomy-tagged entries for an autonomy-scoped query", () => {
    const results = store.retrieveBySignal(
      "autonomy",
      "engineers want more freedom to choose their own projects and schedule",
    );

    expect(results.length).toBeGreaterThan(0);
    for (const entry of results) {
      const tags = [entry.primarySignal, ...entry.secondarySignals].map((s) => s.toLowerCase());
      expect(tags).toContain("autonomy");
    }
  });

  it("returns nothing for a signal that isn't in the corpus's vocabulary", () => {
    const results = store.retrieveBySignal("underwater basket weaving", "anything");
    expect(results).toEqual([]);
  });

  it("finds entries tagged with a compound or parenthetically-qualified signal, by their base signal", () => {
    // These entries use "recognition/rest", "psychological safety/inclusion",
    // "psychological safety/fairness", and "psychological safety (fairness)" /
    // "psychological safety (critique ..., not minutiae)" in the raw corpus.
    const recognitionIds = store.retrieveBySignal("recognition", "rest and time off", 71).map((e) => e.id);
    expect(recognitionIds).toContain("basecamp-sabbatical");

    const restIds = store.retrieveBySignal("rest", "sabbatical", 71).map((e) => e.id);
    expect(restIds).toContain("basecamp-sabbatical");

    const psychSafetyIds = store
      .retrieveBySignal("psychological safety", "writing culture and fairness", 71)
      .map((e) => e.id);
    expect(psychSafetyIds).toEqual(
      expect.arrayContaining([
        "stripe-writing-culture",
        "hashicorp-rfc-prd-culture",
        "basecamp-transparent-pay",
        "google-promotion-calibration",
        "airbnb-dls",
      ]),
    );

    const inclusionIds = store.retrieveBySignal("inclusion", "writing culture", 71).map((e) => e.id);
    expect(inclusionIds).toEqual(
      expect.arrayContaining(["stripe-writing-culture", "hashicorp-rfc-prd-culture"]),
    );
  });

  it("does not split the canonical growth/mastery and purpose/impact visibility signals", () => {
    const growthResults = store.retrieveBySignal("growth/mastery", "learning and skill building", 71);
    expect(growthResults.length).toBeGreaterThan(0);

    // Splitting would have made "growth" and "mastery" separately queryable,
    // which they should NOT be - only the exact canonical name matches.
    expect(store.retrieveBySignal("growth", "anything")).toEqual([]);
    expect(store.retrieveBySignal("mastery", "anything")).toEqual([]);
  });
});
