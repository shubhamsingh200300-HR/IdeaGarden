import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LlmClient, Theme } from "../analysis/llmClient.js";
import type { ProcessedUpload } from "../uploads/derivedDataStore.js";
import type { PublicIdeaCard } from "../generation/generateIdeas.js";
import { AdoptedIdeaStore } from "./adoptedIdeaStore.js";
import { recordCycleOutcomes } from "./recordCycleOutcomes.js";

class FakeThemeLlmClient implements LlmClient {
  constructor(private readonly themes: Theme[]) {}
  async extractThemes(): Promise<Theme[]> {
    return this.themes;
  }
}

function ideaCard(overrides: Partial<PublicIdeaCard> = {}): PublicIdeaCard {
  return {
    title: "Quarterly Promotion Calibration Council",
    description: "A standing panel reviews promotion packets against transparent criteria.",
    signalAddressed: "career progression clarity",
    structuralFormat: "Quarterly, standing panel",
    ownerRole: "Engineering Director",
    sponsorshipLevel: "org",
    estimatedCostInr: 15000,
    estimatedEffort: "4 hours per quarter",
    successMetric: "Improved survey score",
    ...overrides,
  };
}

function processedUpload(overrides: Partial<ProcessedUpload> = {}): ProcessedUpload {
  return {
    teamId: "team-a",
    sourceType: "annual-survey",
    uploadedAt: "2026-04-01T00:00:00.000Z",
    columnClassifications: { Comments: "free-text" },
    rows: [{ status: "clean", values: { Comments: "Still unclear on promotion criteria." } }],
    ...overrides,
  };
}

describe("recordCycleOutcomes", () => {
  let dir: string;
  let adoptedIdeaStore: AdoptedIdeaStore;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "record-cycle-outcomes-"));
    adoptedIdeaStore = new AdoptedIdeaStore(dir, randomBytes(32));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("does nothing when there are no pending adoptions for the team", async () => {
    const themeLlmClient = new FakeThemeLlmClient([]);
    await recordCycleOutcomes({ adoptedIdeaStore, themeLlmClient }, "team-a", processedUpload());
    expect(adoptedIdeaStore.list("team-a")).toEqual([]);
  });

  it("marks improved=true when the targeted signal's mention count dropped in the new cycle", async () => {
    adoptedIdeaStore.adopt("team-a", ideaCard(), { count: 5, sentiment: "negative" });
    const themeLlmClient = new FakeThemeLlmClient([
      { label: "career progression clarity", count: 1, sentiment: "mixed" },
    ]);

    await recordCycleOutcomes({ adoptedIdeaStore, themeLlmClient }, "team-a", processedUpload());

    const [record] = adoptedIdeaStore.list("team-a");
    expect(record.outcome).toEqual({
      comparedAt: expect.any(String),
      after: { count: 1, sentiment: "mixed" },
      improved: true,
    });
  });

  it("marks improved=true (best case) when the signal no longer surfaces at all", async () => {
    adoptedIdeaStore.adopt("team-a", ideaCard(), { count: 5, sentiment: "negative" });
    const themeLlmClient = new FakeThemeLlmClient([{ label: "recognition", count: 3, sentiment: "positive" }]);

    await recordCycleOutcomes({ adoptedIdeaStore, themeLlmClient }, "team-a", processedUpload());

    const [record] = adoptedIdeaStore.list("team-a");
    expect(record.outcome?.after).toBeNull();
    expect(record.outcome?.improved).toBe(true);
  });

  it("marks improved=false when the mention count held steady or rose", async () => {
    adoptedIdeaStore.adopt("team-a", ideaCard(), { count: 5, sentiment: "negative" });
    const themeLlmClient = new FakeThemeLlmClient([
      { label: "career progression clarity", count: 6, sentiment: "negative" },
    ]);

    await recordCycleOutcomes({ adoptedIdeaStore, themeLlmClient }, "team-a", processedUpload());

    expect(adoptedIdeaStore.list("team-a")[0].outcome?.improved).toBe(false);
  });

  it("leaves an already-compared adoption alone on a later run", async () => {
    const record = adoptedIdeaStore.adopt("team-a", ideaCard(), { count: 5, sentiment: "negative" });
    adoptedIdeaStore.recordOutcome("team-a", record.id, { count: 1, sentiment: "positive" }, true);
    const themeLlmClient = new FakeThemeLlmClient([
      { label: "career progression clarity", count: 9, sentiment: "negative" },
    ]);

    await recordCycleOutcomes({ adoptedIdeaStore, themeLlmClient }, "team-a", processedUpload());

    // Still reflects the first comparison, not overwritten by this later run.
    expect(adoptedIdeaStore.list("team-a")[0].outcome?.after).toEqual({ count: 1, sentiment: "positive" });
  });

  it("scopes comparisons to the given team, never touching another team's pending adoptions", async () => {
    adoptedIdeaStore.adopt("team-b", ideaCard(), { count: 5, sentiment: "negative" });
    const themeLlmClient = new FakeThemeLlmClient([
      { label: "career progression clarity", count: 1, sentiment: "positive" },
    ]);

    await recordCycleOutcomes({ adoptedIdeaStore, themeLlmClient }, "team-a", processedUpload({ teamId: "team-a" }));

    expect(adoptedIdeaStore.list("team-b")[0].outcome).toBeNull();
  });
});
