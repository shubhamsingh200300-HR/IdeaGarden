import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { AuthenticatedHrbp, OidcClient } from "../auth/oidcClient.js";
import { InMemoryTeamMappingStore } from "../teams/teamMappingStore.js";
import { RequestIntakeStore } from "../requests/requestIntakeStore.js";
import { DerivedDataStore } from "../uploads/derivedDataStore.js";
import { OnPremVectorStore } from "../corpus/vectorStore.js";
import type { CorpusEntry } from "../corpus/parseBenchmarkCorpus.js";
import type { LlmClient, Theme } from "../analysis/llmClient.js";
import type { GeneratedIdeaDraft, IdeaGenerationInput, IdeaLlmClient } from "./ideaLlmClient.js";

class FakeOidcClient implements OidcClient {
  getAuthorizationUrl(state: string): string {
    return `https://knox.example.test/authorize?state=${state}`;
  }
  async exchangeCodeForTokens(): Promise<AuthenticatedHrbp> {
    throw new Error("not used in these tests");
  }
}

class FakeThemeLlmClient implements LlmClient {
  constructor(private readonly themes: Theme[]) {}
  async extractThemes(): Promise<Theme[]> {
    return this.themes;
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
    estimatedCostInr: 0,
    estimatedEffort: "4 hours per quarter",
    successMetric: "Improved survey score",
    feasibilityScore: 0.8,
    ...overrides,
  };
}

describe("POST /:teamId/ideas/generate", () => {
  let dir: string;

  function buildTestApp() {
    const key = randomBytes(32);
    const teamMappingStore = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
      { teamId: "team-c", teamName: "Design Systems", hrbpId: "hrbp-2" },
    ]);
    const requestIntakeStore = new RequestIntakeStore(join(dir, "requests"), key);
    const derivedDataStore = new DerivedDataStore(join(dir, "derived"), key);
    const themeLlmClient = new FakeThemeLlmClient([
      { label: "career progression clarity", count: 5, sentiment: "negative" },
    ]);
    const ideaLlmClient = new FakeIdeaLlmClient({ "career progression clarity": ideaDraft() });
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);

    const app = buildApp({
      oidcClient: new FakeOidcClient(),
      teamMappingStore,
      sessionSecret: "test-secret",
      devLoginEnabled: true,
      requestIntakeStore,
      analysisDeps: { derivedDataStore, llmClient: themeLlmClient },
      generationDeps: { requestIntakeStore, derivedDataStore, vectorStore, ideaLlmClient, themeLlmClient },
    });
    return { app, requestIntakeStore, derivedDataStore };
  }

  async function loginAs(agent: ReturnType<typeof request.agent>, email: string) {
    await agent.post("/auth/dev-login").type("form").send({ email });
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "generation-routes-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects an unauthenticated request", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/api/teams/team-a/ideas/generate");
    expect(res.status).toBe(401);
  });

  it("rejects a request for a team the HRBP isn't authorized for", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.post("/api/teams/team-c/ideas/generate");
    expect(res.status).toBe(403);
  });

  it("rejects generation when there's no submitted manager input yet", async () => {
    const { app, derivedDataStore } = buildTestApp();
    derivedDataStore.save({
      teamId: "team-a",
      sourceType: "annual-survey",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      columnClassifications: {},
      rows: [],
    });
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.post("/api/teams/team-a/ideas/generate");
    expect(res.status).toBe(409);
  });

  it("rejects generation when there's a pending (not yet submitted) request", async () => {
    const { app, requestIntakeStore, derivedDataStore } = buildTestApp();
    requestIntakeStore.createInvite("team-a", "hrbp-1");
    derivedDataStore.save({
      teamId: "team-a",
      sourceType: "annual-survey",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      columnClassifications: {},
      rows: [],
    });
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.post("/api/teams/team-a/ideas/generate");
    expect(res.status).toBe(409);
  });

  it("rejects generation when there's no ingested survey data yet", async () => {
    const { app, requestIntakeStore } = buildTestApp();
    const invite = requestIntakeStore.createInvite("team-a", "hrbp-1");
    requestIntakeStore.submitByToken(invite.token!, "Some context.", {
      budget: "",
      time: "",
      headcountLogistics: "",
    });
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.post("/api/teams/team-a/ideas/generate");
    expect(res.status).toBe(409);
  });

  it("generates ranked ideas when a submitted request and ingested survey both exist", async () => {
    const { app, requestIntakeStore, derivedDataStore } = buildTestApp();
    const invite = requestIntakeStore.createInvite("team-a", "hrbp-1");
    requestIntakeStore.submitByToken(invite.token!, "Promotion criteria feel arbitrary.", {
      budget: "up to 50,000 INR",
      time: "half a day max",
      headcountLogistics: "team of 8",
    });
    derivedDataStore.save({
      teamId: "team-a",
      sourceType: "annual-survey",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      columnClassifications: { Comments: "free-text" },
      rows: [{ status: "clean", values: { Comments: "Promotion criteria feel arbitrary." } }],
    });

    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");
    const res = await agent.post("/api/teams/team-a/ideas/generate");

    expect(res.status).toBe(200);
    expect(res.body.ideas).toHaveLength(1);
    expect(res.body.ideas[0].title).toBe("Quarterly Promotion Calibration Council");
    expect(res.body.ideas[0]).not.toHaveProperty("feasibilityScore");
    expect(res.body.candidateSignalCount).toBe(1);
  });

  it("returns a clean 502 (not a stack trace) when the upstream LLM call fails", async () => {
    const key = randomBytes(32);
    const teamMappingStore = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
    ]);
    const requestIntakeStore = new RequestIntakeStore(join(dir, "requests"), key);
    const derivedDataStore = new DerivedDataStore(join(dir, "derived"), key);
    const themeLlmClient = new FakeThemeLlmClient([
      { label: "career progression clarity", count: 5, sentiment: "negative" },
    ]);
    // No draft registered for this signal - FakeIdeaLlmClient.generateIdea throws, simulating an upstream failure.
    const failingIdeaLlmClient = new FakeIdeaLlmClient({});
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);

    const app = buildApp({
      oidcClient: new FakeOidcClient(),
      teamMappingStore,
      sessionSecret: "test-secret",
      devLoginEnabled: true,
      requestIntakeStore,
      generationDeps: {
        requestIntakeStore,
        derivedDataStore,
        vectorStore,
        ideaLlmClient: failingIdeaLlmClient,
        themeLlmClient,
      },
    });

    const invite = requestIntakeStore.createInvite("team-a", "hrbp-1");
    requestIntakeStore.submitByToken(invite.token!, "Some context.", {
      budget: "",
      time: "",
      headcountLogistics: "",
    });
    derivedDataStore.save({
      teamId: "team-a",
      sourceType: "annual-survey",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      columnClassifications: { Comments: "free-text" },
      rows: [{ status: "clean", values: { Comments: "Some comment." } }],
    });

    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");
    const res = await agent.post("/api/teams/team-a/ideas/generate");

    expect(res.status).toBe(502);
    expect(res.body.error).not.toContain("no fake draft"); // internal error detail must not leak
  });
});
