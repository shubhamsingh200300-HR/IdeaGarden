import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GeneratedIdeasStore } from "./generatedIdeasStore.js";
import type { GenerationResult } from "./generateIdeas.js";

function idea(overrides: Partial<GenerationResult["ideas"][number]> = {}) {
  return {
    title: "Quarterly Promotion Calibration Council",
    description: "A standing panel reviews promotion packets against transparent criteria.",
    signalAddressed: "career progression clarity",
    structuralFormat: "Quarterly, standing panel",
    ownerRole: "Engineering Director",
    sponsorshipLevel: "org" as const,
    estimatedCostInr: 0,
    estimatedEffort: "4 hours per quarter",
    successMetric: "Improved survey score",
    ...overrides,
  };
}

describe("GeneratedIdeasStore", () => {
  let dir: string;
  let store: GeneratedIdeasStore;
  const key = randomBytes(32);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "generated-ideas-store-"));
    store = new GeneratedIdeasStore(dir, key);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("saves and retrieves the latest batch for a team", () => {
    const result: GenerationResult = { ideas: [idea()], candidateSignalCount: 1 };
    store.save("team-a", result);

    expect(store.getLatest("team-a")).toEqual(result);
  });

  it("returns undefined when nothing has been generated for a team yet", () => {
    expect(store.getLatest("team-a")).toBeUndefined();
  });

  it("scopes batches by team", () => {
    store.save("team-a", { ideas: [idea()], candidateSignalCount: 1 });
    store.save("team-b", { ideas: [idea({ title: "Different Idea" })], candidateSignalCount: 1 });

    expect(store.getLatest("team-a")?.ideas[0].title).toBe("Quarterly Promotion Calibration Council");
    expect(store.getLatest("team-b")?.ideas[0].title).toBe("Different Idea");
  });

  it("overwrites the previous batch on regeneration", () => {
    store.save("team-a", { ideas: [idea()], candidateSignalCount: 1 });
    store.save("team-a", { ideas: [idea({ title: "Regenerated Idea" })], candidateSignalCount: 1 });

    expect(store.getLatest("team-a")?.ideas).toHaveLength(1);
    expect(store.getLatest("team-a")?.ideas[0].title).toBe("Regenerated Idea");
  });
});
