import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { LlmClient, Theme } from "../analysis/llmClient.js";
import type { AuthenticatedHrbp, OidcClient } from "../auth/oidcClient.js";
import type { CorpusEntry } from "../corpus/parseBenchmarkCorpus.js";
import { OnPremVectorStore } from "../corpus/vectorStore.js";
import { GeneratedIdeasStore } from "../generation/generatedIdeasStore.js";
import type { GeneratedIdeaDraft, IdeaGenerationInput, IdeaLlmClient } from "../generation/ideaLlmClient.js";
import { RequestIntakeStore } from "../requests/requestIntakeStore.js";
import { InMemoryTeamMappingStore } from "../teams/teamMappingStore.js";
import { FileAuditLog } from "../uploads/auditLog.js";
import { DerivedDataStore } from "../uploads/derivedDataStore.js";
import { EncryptedFileSystemStore } from "../uploads/rawFileStore.js";
import { buildXlsx } from "../uploads/testFixtures.js";
import { AdoptedIdeaStore } from "./adoptedIdeaStore.js";

class FakeOidcClient implements OidcClient {
  getAuthorizationUrl(state: string): string {
    return `https://knox.example.test/authorize?state=${state}`;
  }
  async exchangeCodeForTokens(): Promise<AuthenticatedHrbp> {
    throw new Error("not used in these tests");
  }
}

/** Returns each theme set in order for successive calls, then repeats the last - lets a single test drive distinct survey cycles through the same fake without rewiring deps mid-test. */
class SequencedThemeLlmClient implements LlmClient {
  private callCount = 0;
  constructor(private readonly sequence: Theme[][]) {}
  async extractThemes(): Promise<Theme[]> {
    const themes = this.sequence[Math.min(this.callCount, this.sequence.length - 1)];
    this.callCount++;
    return themes;
  }
}

class FakeIdeaLlmClient implements IdeaLlmClient {
  constructor(private readonly drafts: Record<string, GeneratedIdeaDraft>) {}
  async generateIdea(input: IdeaGenerationInput): Promise<GeneratedIdeaDraft> {
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
    estimatedCostInr: 15000,
    estimatedEffort: "4 hours per quarter",
    successMetric: "Improved survey score",
    feasibilityScore: 0.8,
    ...overrides,
  };
}

describe("post-launch tracking, end to end through real HTTP (ticket 08)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "post-launch-tracking-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("shows a visible before/after comparison once an adopted idea's signal is re-measured on the next survey cycle, with no manual comparison step", async () => {
    const key = randomBytes(32);
    const teamMappingStore = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
    ]);
    const requestIntakeStore = new RequestIntakeStore(join(dir, "requests"), key);
    const derivedDataStore = new DerivedDataStore(join(dir, "derived"), key);
    const generatedIdeasStore = new GeneratedIdeasStore(join(dir, "generated"), key);
    const adoptedIdeaStore = new AdoptedIdeaStore(join(dir, "adopted"), key);
    // Call order: (1) generate, (2) adopt's baseline capture (re-analyzes
    // the still-current cycle-1 data), (3) recordCycleOutcomes after the
    // cycle-2 upload.
    const themeLlmClient = new SequencedThemeLlmClient([
      [{ label: "career progression clarity", count: 5, sentiment: "negative" }],
      [{ label: "career progression clarity", count: 5, sentiment: "negative" }],
      [{ label: "career progression clarity", count: 1, sentiment: "mixed" }],
    ]);
    const ideaLlmClient = new FakeIdeaLlmClient({ "career progression clarity": ideaDraft() });
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);
    const ingestDeps = {
      rawFileStore: new EncryptedFileSystemStore(join(dir, "raw"), key),
      derivedDataStore,
      auditLog: new FileAuditLog(join(dir, "audit.log")),
    };

    const app = buildApp({
      oidcClient: new FakeOidcClient(),
      teamMappingStore,
      sessionSecret: "test-secret",
      devLoginEnabled: true,
      ingestDeps,
      requestIntakeStore,
      generationDeps: {
        requestIntakeStore,
        derivedDataStore,
        generatedIdeasStore,
        vectorStore,
        ideaLlmClient,
        themeLlmClient,
        adoptedIdeaStore,
      },
      trackingDeps: { adoptedIdeaStore, themeLlmClient },
    });

    const agent = request.agent(app);
    await agent.post("/auth/dev-login").type("form").send({ email: "hrbp-1" });

    const cycle1 = await buildXlsx(["Comments"], [["Promotion criteria feel arbitrary and unclear."]]);
    await agent.post("/api/teams/team-a/uploads/annual-survey").attach("file", cycle1, "cycle1.xlsx");

    const invite = requestIntakeStore.createInvite("team-a", "hrbp-1");
    requestIntakeStore.submitByToken(invite.token!, "Promotion criteria feel arbitrary.", {
      budget: "",
      time: "",
      headcountLogistics: "",
    });

    await agent.post("/dashboard/teams/team-a/ideas/generate").type("form").send({});
    await agent.post("/dashboard/teams/team-a/ideas/adopt").type("form").send({ ideaIndex: "0" });

    const cycle2 = await buildXlsx(["Comments"], [["Much clearer on promotion criteria now."]]);
    const uploadRes = await agent
      .post("/api/teams/team-a/uploads/annual-survey")
      .attach("file", cycle2, "cycle2.xlsx");
    expect(uploadRes.status).toBe(200);

    const pageRes = await agent.get("/dashboard/teams/team-a/ideas");

    expect(pageRes.text).toContain("Adopted ideas");
    expect(pageRes.text).toContain("5 mention(s)");
    expect(pageRes.text).toContain("1 mention(s)");
    expect(pageRes.text).toContain("improved");
    expect(pageRes.text).not.toContain("awaiting the next survey cycle");
  });
});
