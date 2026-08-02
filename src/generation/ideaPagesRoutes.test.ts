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
import { GeneratedIdeasStore } from "./generatedIdeasStore.js";
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
  public receivedInputs: IdeaGenerationInput[] = [];
  constructor(private drafts: Record<string, GeneratedIdeaDraft>) {}
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
    estimatedCostInr: 15000,
    estimatedEffort: "4 hours per quarter",
    successMetric: "Improved survey score",
    feasibilityScore: 0.8,
    ...overrides,
  };
}

describe("idea pages (HTML)", () => {
  let dir: string;

  function buildTestApp() {
    const key = randomBytes(32);
    const teamMappingStore = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
      { teamId: "team-c", teamName: "Design Systems", hrbpId: "hrbp-2" },
    ]);
    const requestIntakeStore = new RequestIntakeStore(join(dir, "requests"), key);
    const derivedDataStore = new DerivedDataStore(join(dir, "derived"), key);
    const generatedIdeasStore = new GeneratedIdeasStore(join(dir, "generated"), key);
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
      generationDeps: {
        requestIntakeStore,
        derivedDataStore,
        generatedIdeasStore,
        vectorStore,
        ideaLlmClient,
        themeLlmClient,
      },
    });
    return { app, requestIntakeStore, derivedDataStore, generatedIdeasStore, ideaLlmClient };
  }

  async function loginAs(agent: ReturnType<typeof request.agent>, email: string) {
    await agent.post("/auth/dev-login").type("form").send({ email });
  }

  function seedReadyTeam(deps: ReturnType<typeof buildTestApp>, teamId = "team-a") {
    const invite = deps.requestIntakeStore.createInvite(teamId, "hrbp-1");
    deps.requestIntakeStore.submitByToken(invite.token!, "Promotion criteria feel arbitrary.", {
      budget: "up to 50,000 INR",
      time: "half a day max",
      headcountLogistics: "team of 8",
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
    dir = mkdtempSync(join(tmpdir(), "idea-pages-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("redirects an unauthenticated visitor to the login page", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/dashboard/teams/team-a/ideas");
    expect(res.status).toBe(302);
  });

  it("shows a not-authorized page for a team the HRBP isn't mapped to", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.get("/dashboard/teams/team-c/ideas");

    expect(res.status).toBe(403);
    expect(res.text.toLowerCase()).toContain("not authorized");
  });

  it("shows a generate prompt when nothing has been generated yet", async () => {
    const deps = buildTestApp();
    const agent = request.agent(deps.app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.get("/dashboard/teams/team-a/ideas");

    expect(res.status).toBe(200);
    expect(res.text).toContain("<form");
    expect(res.text.toLowerCase()).toContain("generate");
  });

  it("renders all seven fields for each idea, with cost shown in INR", async () => {
    const deps = buildTestApp();
    deps.generatedIdeasStore.save("team-a", {
      ideas: [ideaDraft()].map((d) => ({
        title: d.title,
        description: d.description,
        signalAddressed: d.signalAddressed,
        structuralFormat: d.structuralFormat,
        ownerRole: d.ownerRole!,
        sponsorshipLevel: d.sponsorshipLevel!,
        estimatedCostInr: d.estimatedCostInr,
        estimatedEffort: d.estimatedEffort,
        successMetric: d.successMetric,
      })),
      candidateSignalCount: 1,
    });

    const agent = request.agent(deps.app);
    await loginAs(agent, "hrbp-1");
    const res = await agent.get("/dashboard/teams/team-a/ideas");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Quarterly Promotion Calibration Council");
    expect(res.text).toContain("A standing panel reviews promotion packets against transparent criteria.");
    expect(res.text).toContain("career progression clarity");
    expect(res.text).toContain("Quarterly, standing panel");
    expect(res.text).toContain("Engineering Director");
    expect(res.text).toContain("org");
    expect(res.text).toMatch(/INR\s*15,?000|15,?000\s*INR/i);
    expect(res.text).toContain("4 hours per quarter");
    expect(res.text).toContain("Improved survey score");
    // No internal scores exposed on the page.
    expect(res.text).not.toContain("feasibilityScore");
  });

  it("never renders raw markup even if estimatedCostInr isn't actually a number at runtime", async () => {
    // enterpriseIdeaLlmClient.ts parses the LLM response with a bare type
    // assertion (`as GeneratedIdeaDraft`), not runtime validation, so a
    // malformed/adversarial upstream response could put anything in this
    // field despite the TypeScript type claiming `number`. escapeHtml
    // covers every other field, but this one bypasses it since it's
    // normally rendered via toLocaleString(), not escapeHtml.
    const deps = buildTestApp();
    const malicious = { ...ideaDraft(), estimatedCostInr: "<script>alert(1)</script>" as unknown as number };
    deps.generatedIdeasStore.save("team-a", {
      ideas: [
        {
          title: malicious.title,
          description: malicious.description,
          signalAddressed: malicious.signalAddressed,
          structuralFormat: malicious.structuralFormat,
          ownerRole: malicious.ownerRole!,
          sponsorshipLevel: malicious.sponsorshipLevel!,
          estimatedCostInr: malicious.estimatedCostInr,
          estimatedEffort: malicious.estimatedEffort,
          successMetric: malicious.successMetric,
        },
      ],
      candidateSignalCount: 1,
    });

    const agent = request.agent(deps.app);
    await loginAs(agent, "hrbp-1");
    const res = await agent.get("/dashboard/teams/team-a/ideas");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("<script>alert(1)</script>");
  });

  it("triggers generation via the form and redirects back to the ideas page with a fresh batch", async () => {
    const deps = buildTestApp();
    seedReadyTeam(deps);
    const agent = request.agent(deps.app);
    await loginAs(agent, "hrbp-1");

    const postRes = await agent.post("/dashboard/teams/team-a/ideas/generate").type("form").send({});

    expect(postRes.status).toBe(303);
    expect(postRes.headers.location).toBe("/dashboard/teams/team-a/ideas");
    expect(deps.generatedIdeasStore.getLatest("team-a")?.ideas).toHaveLength(1);
  });

  it("regenerating with additional context does not require a brand-new submitted request", async () => {
    const deps = buildTestApp();
    seedReadyTeam(deps);
    const agent = request.agent(deps.app);
    await loginAs(agent, "hrbp-1");

    await agent.post("/dashboard/teams/team-a/ideas/generate").type("form").send({});
    const firstBatch = deps.generatedIdeasStore.getLatest("team-a");

    await agent
      .post("/dashboard/teams/team-a/ideas/generate")
      .type("form")
      .send({ additionalContext: "The team is now fully remote." });

    expect(deps.ideaLlmClient.receivedInputs.at(-1)?.context).toContain("The team is now fully remote.");
    expect(deps.generatedIdeasStore.getLatest("team-a")).toBeDefined();
    expect(firstBatch).toBeDefined();
  });
});
