import { describe, expect, it } from "vitest";
import { OnPremVectorStore } from "./vectorStore.js";
import type { CorpusEntry } from "./parseBenchmarkCorpus.js";

function entry(overrides: Partial<CorpusEntry>): CorpusEntry {
  return {
    id: "id",
    company: "Co",
    initiative: "Initiative",
    primarySignal: "autonomy",
    secondarySignals: [],
    structure: "",
    impactEvidence: "",
    sources: [],
    ...overrides,
  };
}

describe("OnPremVectorStore", () => {
  const entries: CorpusEntry[] = [
    entry({
      id: "hackathon",
      primarySignal: "autonomy",
      secondarySignals: ["recognition"],
      structure: "An annual 24-hour hackathon where engineers build side projects.",
    }),
    entry({
      id: "unlimited-pto",
      primarySignal: "autonomy",
      secondarySignals: [],
      structure: "Employees take vacation whenever they want with no formal tracking.",
    }),
    entry({
      id: "kudos",
      primarySignal: "recognition",
      secondarySignals: ["belonging"],
      structure: "Peer-to-peer recognition program with kudos and small awards.",
    }),
    entry({
      id: "mentorship",
      primarySignal: "growth/mastery",
      secondarySignals: ["career progression clarity"],
      structure: "Mentorship program pairing junior and senior engineers.",
    }),
  ];
  const store = new OnPremVectorStore(entries);

  it("only returns entries tagged with the queried signal (primary or secondary)", () => {
    const results = store.retrieveBySignal("recognition", "team celebration");
    const ids = results.map((r) => r.id);

    expect(ids).toContain("hackathon"); // tagged via secondary
    expect(ids).toContain("kudos"); // tagged via primary
    expect(ids).not.toContain("unlimited-pto");
    expect(ids).not.toContain("mentorship");
  });

  it("is case-insensitive when matching the signal", () => {
    const results = store.retrieveBySignal("Recognition", "anything");
    expect(results.map((r) => r.id)).toContain("kudos");
  });

  it("ranks same-signal entries by similarity to the query text", () => {
    const results = store.retrieveBySignal("autonomy", "annual hackathon building side projects");

    expect(results[0].id).toBe("hackathon");
  });

  it("degrades gracefully for a signal with no matching entries", () => {
    const results = store.retrieveBySignal("purpose/impact visibility", "anything");
    expect(results).toEqual([]);
  });

  it("returns just the one entry for a signal with only one match", () => {
    const results = store.retrieveBySignal("growth/mastery", "anything");
    expect(results.map((r) => r.id)).toEqual(["mentorship"]);
  });

  it("respects a topK limit", () => {
    const results = store.retrieveBySignal("autonomy", "vacation and hackathons", 1);
    expect(results).toHaveLength(1);
  });
});

describe("OnPremVectorStore.addEntry (ticket 09: re-indexing on approval)", () => {
  it("makes a newly added entry immediately retrievable, with no re-construction of the store", () => {
    const store = new OnPremVectorStore([
      entry({ id: "existing", primarySignal: "autonomy", structure: "An existing autonomy initiative." }),
    ]);

    expect(store.retrieveBySignal("growth/mastery", "design critique").map((e) => e.id)).toEqual([]);

    store.addEntry(
      entry({
        id: "new-entry",
        primarySignal: "growth/mastery",
        structure: "A weekly design critique session.",
      }),
    );

    expect(store.retrieveBySignal("growth/mastery", "design critique").map((e) => e.id)).toEqual(["new-entry"]);
  });

  it("still ranks correctly by similarity across old and newly added entries together", () => {
    const store = new OnPremVectorStore([
      entry({ id: "old-hackathon", primarySignal: "autonomy", structure: "An annual hackathon for engineers." }),
    ]);
    store.addEntry(
      entry({ id: "new-hackathon", primarySignal: "autonomy", structure: "A quarterly hackathon for designers." }),
    );

    const results = store.retrieveBySignal("autonomy", "quarterly hackathon for designers");
    expect(results[0].id).toBe("new-hackathon");
  });

  it("does not affect entries tagged with a different signal", () => {
    const store = new OnPremVectorStore([entry({ id: "kudos", primarySignal: "recognition" })]);
    store.addEntry(entry({ id: "new-entry", primarySignal: "autonomy" }));

    expect(store.retrieveBySignal("recognition", "anything").map((e) => e.id)).toEqual(["kudos"]);
  });
});

describe("OnPremVectorStore.listEntries", () => {
  it("returns every entry currently in the store, including ones added after construction", () => {
    const store = new OnPremVectorStore([entry({ id: "a" })]);
    store.addEntry(entry({ id: "b" }));

    expect(store.listEntries().map((e) => e.id)).toEqual(["a", "b"]);
  });
});
