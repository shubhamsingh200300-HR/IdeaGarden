import { describe, expect, it } from "vitest";
import { loadCorpus } from "./loadCorpus.js";

describe("loadCorpus (against the real benchmark-corpus.md)", () => {
  const entries = loadCorpus();

  it("loads all 71 documented initiatives", () => {
    expect(entries).toHaveLength(71);
  });

  it("every entry has a primary signal and at least an id, company, and initiative", () => {
    for (const entry of entries) {
      expect(entry.id).not.toBe("");
      expect(entry.company).not.toBe("");
      expect(entry.initiative).not.toBe("");
      expect(entry.primarySignal).not.toBe("");
    }
  });

  it("includes a known entry with its expected signal tags", () => {
    const shipIt = entries.find((e) => e.id === "atlassian-shipit-days");
    expect(shipIt).toBeDefined();
    expect(shipIt?.primarySignal).toBe("autonomy");
    expect(shipIt?.secondarySignals).toContain("recognition");
  });
});
