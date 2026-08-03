import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { LlmClient, Theme } from "../analysis/llmClient.js";
import { GeneratedIdeasStore } from "../generation/generatedIdeasStore.js";
import type { PublicIdeaCard } from "../generation/generateIdeas.js";
import { DerivedDataStore } from "../uploads/derivedDataStore.js";
import { AdoptedIdeaStore } from "./adoptedIdeaStore.js";
import { adoptIdea } from "./adoptIdea.js";

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

describe("adoptIdea", () => {
  let dir: string;

  function buildDeps(themes: Theme[] = [{ label: "career progression clarity", count: 5, sentiment: "negative" }]) {
    const key = randomBytes(32);
    return {
      generatedIdeasStore: new GeneratedIdeasStore(join(dir, "generated"), key),
      derivedDataStore: new DerivedDataStore(join(dir, "derived"), key),
      themeLlmClient: new FakeThemeLlmClient(themes),
      adoptedIdeaStore: new AdoptedIdeaStore(join(dir, "adopted"), key),
    };
  }

  function seedSurvey(deps: ReturnType<typeof buildDeps>, teamId = "team-a") {
    deps.derivedDataStore.save({
      teamId,
      sourceType: "annual-survey",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      columnClassifications: { Comments: "free-text" },
      rows: [{ status: "clean", values: { Comments: "Promotion criteria feel arbitrary." } }],
    });
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "adopt-idea-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns not-found when there's no generated batch for the team", async () => {
    const deps = buildDeps();
    const result = await adoptIdea(deps, "team-a", 0);
    expect(result.status).toBe("not-found");
  });

  it("returns not-found when the index is out of range for the latest batch", async () => {
    const deps = buildDeps();
    deps.generatedIdeasStore.save("team-a", { ideas: [ideaCard()], candidateSignalCount: 1 });

    const result = await adoptIdea(deps, "team-a", 5);
    expect(result.status).toBe("not-found");
  });

  it("captures the current signal's count and sentiment as the baseline snapshot", async () => {
    const deps = buildDeps();
    seedSurvey(deps);
    deps.generatedIdeasStore.save("team-a", { ideas: [ideaCard()], candidateSignalCount: 1 });

    const result = await adoptIdea(deps, "team-a", 0);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.record.baseline).toEqual({ count: 5, sentiment: "negative" });
    expect(result.record.idea.title).toBe("Quarterly Promotion Calibration Council");
    expect(result.record.outcome).toBeNull();
  });

  it("persists the adoption to the store", async () => {
    const deps = buildDeps();
    seedSurvey(deps);
    deps.generatedIdeasStore.save("team-a", { ideas: [ideaCard()], candidateSignalCount: 1 });

    await adoptIdea(deps, "team-a", 0);

    expect(deps.adoptedIdeaStore.list("team-a")).toHaveLength(1);
  });

  it("uses a null baseline when there's no survey data at all for the team", async () => {
    const deps = buildDeps();
    deps.generatedIdeasStore.save("team-a", { ideas: [ideaCard()], candidateSignalCount: 1 });

    const result = await adoptIdea(deps, "team-a", 0);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.record.baseline).toBeNull();
  });

  it("uses a null baseline when the idea's signal no longer matches anything in the current analysis", async () => {
    const deps = buildDeps([{ label: "recognition", count: 2, sentiment: "positive" }]);
    seedSurvey(deps);
    deps.generatedIdeasStore.save("team-a", { ideas: [ideaCard()], candidateSignalCount: 1 });

    const result = await adoptIdea(deps, "team-a", 0);

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.record.baseline).toBeNull();
  });
});
