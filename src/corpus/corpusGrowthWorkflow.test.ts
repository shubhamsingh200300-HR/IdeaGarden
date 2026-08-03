import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { LlmClient, Theme } from "../analysis/llmClient.js";
import type { AuthenticatedHrbp, OidcClient } from "../auth/oidcClient.js";
import { GeneratedIdeasStore } from "../generation/generatedIdeasStore.js";
import type { GeneratedIdeaDraft, IdeaGenerationInput, IdeaLlmClient } from "../generation/ideaLlmClient.js";
import { RequestIntakeStore } from "../requests/requestIntakeStore.js";
import { InMemoryTeamMappingStore } from "../teams/teamMappingStore.js";
import { AdoptedIdeaStore } from "../tracking/adoptedIdeaStore.js";
import { DerivedDataStore } from "../uploads/derivedDataStore.js";
import { CorpusProposalStore } from "./corpusProposalStore.js";
import { OnPremVectorStore } from "./vectorStore.js";

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
  public receivedInputs: IdeaGenerationInput[] = [];
  constructor(private readonly draft: GeneratedIdeaDraft) {}
  async generateIdea(input: IdeaGenerationInput): Promise<GeneratedIdeaDraft> {
    this.receivedInputs.push(input);
    return this.draft;
  }
}

function ideaDraft(overrides: Partial<GeneratedIdeaDraft> = {}): GeneratedIdeaDraft {
  return {
    title: "Weekly Design Critique",
    description: "A recurring open critique session for in-progress design work.",
    signalAddressed: "growth/mastery",
    structuralFormat: "Weekly, standing session",
    isRecurringOrStructural: true,
    ownerRole: "Design Director",
    sponsorshipLevel: "org",
    estimatedCostInr: 0,
    estimatedEffort: "1 hour per week",
    successMetric: "Improved survey score",
    feasibilityScore: 0.8,
    ...overrides,
  };
}

function validProposalBody(overrides: Record<string, unknown> = {}) {
  return {
    company: "Figma",
    initiative: "Design Critique Fridays",
    primarySignal: "growth/mastery",
    secondarySignals: [],
    structure: "A weekly open critique session where any designer can present in-progress work.",
    impactEvidence: "No public quantitative data found.",
    sources: ["https://figma.com/blog/design-critique — first-party description of the ritual"],
    ...overrides,
  };
}

describe("corpus growth workflow, end to end through real HTTP (ticket 09)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "corpus-growth-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("an approved proposal is retrievable via ticket 02's retrieval query, and even feeds a real idea-generation request against the same shared vector store", async () => {
    const key = randomBytes(32);
    const teamMappingStore = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Design Systems", hrbpId: "hrbp-1" },
    ]);
    const requestIntakeStore = new RequestIntakeStore(join(dir, "requests"), key);
    const derivedDataStore = new DerivedDataStore(join(dir, "derived"), key);
    const generatedIdeasStore = new GeneratedIdeasStore(join(dir, "generated"), key);
    const adoptedIdeaStore = new AdoptedIdeaStore(join(dir, "adopted"), key);
    const vectorStore = new OnPremVectorStore([]); // starts empty - the only entry comes from approval
    const proposalStore = new CorpusProposalStore(join(dir, "proposals"), key);
    const corpusFilePath = join(dir, "benchmark-corpus.md");
    writeFileSync(corpusFilePath, "# Benchmark corpus\n\n## Growth & Mastery\n");
    const themeLlmClient = new FakeThemeLlmClient([
      { label: "growth/mastery", count: 4, sentiment: "negative" },
    ]);
    const ideaLlmClient = new FakeIdeaLlmClient(ideaDraft());

    const app = buildApp({
      oidcClient: new FakeOidcClient(),
      teamMappingStore,
      sessionSecret: "test-secret",
      devLoginEnabled: true,
      requestIntakeStore,
      corpusDeps: { proposalStore, vectorStore, corpusFilePath },
      generationDeps: {
        requestIntakeStore,
        derivedDataStore,
        generatedIdeasStore,
        vectorStore, // same instance the corpus routes mutate on approval
        ideaLlmClient,
        themeLlmClient,
        adoptedIdeaStore,
      },
    });

    const agent = request.agent(app);
    await agent.post("/auth/dev-login").type("form").send({ email: "hrbp-1" });

    const proposeRes = await agent.post("/api/corpus/proposals").send(validProposalBody());
    expect(proposeRes.status).toBe(201);
    const entryId = proposeRes.body.entry.id;

    // Not yet approved - the live retrieval surface must not see it.
    expect(vectorStore.retrieveBySignal("growth/mastery", "design critique").map((e: { id: string }) => e.id)).toEqual(
      [],
    );

    const approveRes = await agent.post(`/api/corpus/proposals/${entryId}/approve`);
    expect(approveRes.status).toBe(200);

    // Ticket 02's retrieval query now finds it, with no restart.
    const retrieved = vectorStore.retrieveBySignal("growth/mastery", "design critique");
    expect(retrieved.map((e) => e.id)).toContain(entryId);

    // It also reaches a real generation request through the exact same shared store.
    derivedDataStore.save({
      teamId: "team-a",
      sourceType: "annual-survey",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      columnClassifications: { Comments: "free-text" },
      rows: [{ status: "clean", values: { Comments: "Hard to grow as a designer here." } }],
    });
    const invite = requestIntakeStore.createInvite("team-a", "hrbp-1");
    requestIntakeStore.submitByToken(invite.token!, "Designers feel stuck.", {
      budget: "",
      time: "",
      headcountLogistics: "",
    });

    const generateRes = await agent.post("/api/teams/team-a/ideas/generate");

    expect(generateRes.status).toBe(200);
    expect(ideaLlmClient.receivedInputs[0].corpusExamples.map((c) => c.company)).toContain("Figma");
  });

  it("a rejected proposal never appears in retrieval results", async () => {
    const key = randomBytes(32);
    const teamMappingStore = new InMemoryTeamMappingStore([]);
    const vectorStore = new OnPremVectorStore([]);
    const proposalStore = new CorpusProposalStore(join(dir, "proposals"), key);
    const corpusFilePath = join(dir, "benchmark-corpus.md");
    writeFileSync(corpusFilePath, "# Benchmark corpus\n\n## Growth & Mastery\n");

    const app = buildApp({
      oidcClient: new FakeOidcClient(),
      teamMappingStore,
      sessionSecret: "test-secret",
      devLoginEnabled: true,
      corpusDeps: { proposalStore, vectorStore, corpusFilePath },
    });

    const agent = request.agent(app);
    await agent.post("/auth/dev-login").type("form").send({ email: "hrbp-1" });

    const proposeRes = await agent.post("/api/corpus/proposals").send(validProposalBody());
    const entryId = proposeRes.body.entry.id;

    const rejectRes = await agent.post(`/api/corpus/proposals/${entryId}/reject`);
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe("rejected");

    expect(vectorStore.retrieveBySignal("growth/mastery", "design critique")).toEqual([]);
    expect(vectorStore.listEntries()).toEqual([]);

    // Rejected proposals are discarded, not silently retried - a second
    // approve attempt on the same id must not succeed after rejection.
    const lateApprove = await agent.post(`/api/corpus/proposals/${entryId}/approve`);
    expect(lateApprove.status).toBe(409);
    expect(vectorStore.listEntries()).toEqual([]);
  });
});
