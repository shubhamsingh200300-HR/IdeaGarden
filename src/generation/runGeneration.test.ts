import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RequestIntakeStore } from "../requests/requestIntakeStore.js";
import { DerivedDataStore } from "../uploads/derivedDataStore.js";
import { OnPremVectorStore } from "../corpus/vectorStore.js";
import type { CorpusEntry } from "../corpus/parseBenchmarkCorpus.js";
import type { LlmClient, Theme } from "../analysis/llmClient.js";
import { GeneratedIdeasStore } from "./generatedIdeasStore.js";
import { runGeneration } from "./runGeneration.js";
import type { GeneratedIdeaDraft, IdeaGenerationInput, IdeaLlmClient } from "./ideaLlmClient.js";

class FakeThemeLlmClient implements LlmClient {
  constructor(private readonly themes: Theme[]) {}
  async extractThemes(): Promise<Theme[]> {
    return this.themes;
  }
}

class FakeIdeaLlmClient implements IdeaLlmClient {
  public receivedInputs: IdeaGenerationInput[] = [];
  constructor(private readonly drafts: Record<string, GeneratedIdeaDraft>) {}
  async generateIdea(input: IdeaGenerationInput): Promise<GeneratedIdeaDraft> {
    this.receivedInputs.push(input);
    const found = this.drafts[input.signal];
    if (!found) throw new Error(`no fake draft for signal ${input.signal}`);
    return found;
  }
}

function corpusEntry(overrides: Partial<CorpusEntry>): CorpusEntry {
  return {
    id: "id",
    company: "Co",
    initiative: "Initiative",
    primarySignal: "career progression clarity",
    secondarySignals: [],
    structure: "A standing program.",
    impactEvidence: "",
    sources: [],
    ...overrides,
  };
}

function ideaDraft(overrides: Partial<GeneratedIdeaDraft> = {}): GeneratedIdeaDraft {
  return {
    title: "Quarterly Promotion Calibration Council",
    description: "A standing panel reviews promotion packets against transparent criteria.",
    signalAddressed: "career progression clarity",
    structuralFormat: "Quarterly, standing panel",
    isRecurringOrStructural: true,
    ownerRole: "Engineering Director",
    sponsorshipLevel: "org",
    estimatedCostInr: 0,
    estimatedEffort: "4 hours per quarter",
    successMetric: "Improved survey score",
    feasibilityScore: 0.8,
    ...overrides,
  };
}

describe("runGeneration", () => {
  let dir: string;

  function buildDeps(ideaLlmClient: IdeaLlmClient = new FakeIdeaLlmClient({ "career progression clarity": ideaDraft() })) {
    const key = randomBytes(32);
    const requestIntakeStore = new RequestIntakeStore(join(dir, "requests"), key);
    const derivedDataStore = new DerivedDataStore(join(dir, "derived"), key);
    const generatedIdeasStore = new GeneratedIdeasStore(join(dir, "generated"), key);
    const themeLlmClient = new FakeThemeLlmClient([
      { label: "career progression clarity", count: 5, sentiment: "negative" },
    ]);
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);
    return { requestIntakeStore, derivedDataStore, generatedIdeasStore, vectorStore, ideaLlmClient, themeLlmClient };
  }

  function seedReadyTeam(deps: ReturnType<typeof buildDeps>, teamId = "team-a") {
    const invite = deps.requestIntakeStore.createInvite(teamId, "hrbp-1");
    deps.requestIntakeStore.submitByToken(invite.token!, "Promotion criteria feel arbitrary.", {
      budget: "",
      time: "",
      headcountLogistics: "",
    });
    deps.derivedDataStore.save({
      teamId,
      sourceType: "annual-survey",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      columnClassifications: { Comments: "free-text" },
      rows: [{ status: "clean", values: { Comments: "Promotion criteria feel arbitrary." } }],
    });
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "run-generation-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns not-ready when there's no submitted request", async () => {
    const deps = buildDeps();
    const result = await runGeneration(deps, "team-a");
    expect(result.status).toBe("not-ready");
  });

  it("returns not-ready when there's no ingested survey", async () => {
    const deps = buildDeps();
    const invite = deps.requestIntakeStore.createInvite("team-a", "hrbp-1");
    deps.requestIntakeStore.submitByToken(invite.token!, "Some context.", {
      budget: "",
      time: "",
      headcountLogistics: "",
    });

    const result = await runGeneration(deps, "team-a");
    expect(result.status).toBe("not-ready");
  });

  it("returns error (not a thrown exception) when the LLM call fails", async () => {
    const failingIdeaLlmClient = new FakeIdeaLlmClient({});
    const deps = buildDeps(failingIdeaLlmClient);
    seedReadyTeam(deps);

    const result = await runGeneration(deps, "team-a");
    expect(result.status).toBe("error");
  });

  it("generates and saves the result so it can be retrieved without regenerating", async () => {
    const deps = buildDeps();
    seedReadyTeam(deps);

    const result = await runGeneration(deps, "team-a");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.result.ideas).toHaveLength(1);
    expect(deps.generatedIdeasStore.getLatest("team-a")).toEqual(result.result);
  });

  it("passes additional context through to generation for a regeneration attempt", async () => {
    const ideaLlmClient = new FakeIdeaLlmClient({ "career progression clarity": ideaDraft() });
    const deps = buildDeps(ideaLlmClient);
    seedReadyTeam(deps);

    await runGeneration(deps, "team-a", "The team is now fully remote.");

    expect(ideaLlmClient.receivedInputs[0].context).toContain("The team is now fully remote.");
  });

  it("regenerating overwrites the previously saved batch", async () => {
    const deps = buildDeps();
    seedReadyTeam(deps);

    await runGeneration(deps, "team-a");
    const second = await runGeneration(deps, "team-a");

    if (second.status !== "ok") throw new Error("expected ok");
    expect(deps.generatedIdeasStore.getLatest("team-a")).toEqual(second.result);
  });
});
