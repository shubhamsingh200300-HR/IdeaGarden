import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { AuthenticatedHrbp, OidcClient } from "../auth/oidcClient.js";
import { InMemoryTeamMappingStore } from "../teams/teamMappingStore.js";
import { DerivedDataStore } from "../uploads/derivedDataStore.js";
import type { LlmClient, Theme } from "./llmClient.js";

class FakeOidcClient implements OidcClient {
  getAuthorizationUrl(state: string): string {
    return `https://knox.example.test/authorize?state=${state}`;
  }
  async exchangeCodeForTokens(): Promise<AuthenticatedHrbp> {
    throw new Error("not used in these tests");
  }
}

class FakeLlmClient implements LlmClient {
  constructor(private readonly themes: Theme[] = []) {}
  async extractThemes(): Promise<Theme[]> {
    return this.themes;
  }
}

describe("GET /:teamId/analysis", () => {
  let dir: string;

  function buildTestApp(llmClient: LlmClient = new FakeLlmClient()) {
    const key = randomBytes(32);
    const teamMappingStore = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
      { teamId: "team-c", teamName: "Design Systems", hrbpId: "hrbp-2" },
    ]);
    const derivedDataStore = new DerivedDataStore(dir, key);
    const app = buildApp({
      oidcClient: new FakeOidcClient(),
      teamMappingStore,
      sessionSecret: "test-secret",
      devLoginEnabled: true,
      analysisDeps: { derivedDataStore, llmClient },
    });
    return { app, derivedDataStore };
  }

  async function loginAs(agent: ReturnType<typeof request.agent>, email: string) {
    await agent.post("/auth/dev-login").type("form").send({ email });
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "analysis-routes-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects an unauthenticated request", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/api/teams/team-a/analysis");
    expect(res.status).toBe(401);
  });

  it("rejects a request for a team the HRBP isn't authorized for", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.get("/api/teams/team-c/analysis");
    expect(res.status).toBe(403);
  });

  it("returns 404 when no survey has been ingested for the team yet", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.get("/api/teams/team-a/analysis");
    expect(res.status).toBe(404);
  });

  it("returns a diagnosed-signals summary for an ingested team", async () => {
    const llmClient = new FakeLlmClient([
      { label: "career progression clarity", count: 4, sentiment: "negative" },
    ]);
    const { app, derivedDataStore } = buildTestApp(llmClient);
    derivedDataStore.save({
      teamId: "team-a",
      sourceType: "annual-survey",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      columnClassifications: { Department: "structured", Comments: "free-text" },
      rows: [
        { status: "clean", values: { Department: "Engineering", Comments: "Growth feels unclear." } },
        { status: "clean", values: { Department: "Engineering", Comments: "Same here." } },
        { status: "clean", values: { Department: "Engineering", Comments: "Agreed." } },
        { status: "clean", values: { Department: "Engineering", Comments: "Yes." } },
        { status: "clean", values: { Department: "Engineering", Comments: "Definitely." } },
      ],
    });

    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");
    const res = await agent.get("/api/teams/team-a/analysis");

    expect(res.status).toBe(200);
    expect(res.body.teamId).toBe("team-a");
    expect(res.body.structuredDimensions).toContainEqual({
      column: "Department",
      breakdown: [{ value: "Engineering", count: 5 }],
    });
    expect(res.body.freeTextThemes).toContainEqual({
      column: "Comments",
      label: "career progression clarity",
      count: 4,
      sentiment: "negative",
    });
  });

  it("defaults to the annual-survey source type and lets a different one be requested explicitly", async () => {
    const { app, derivedDataStore } = buildTestApp();
    derivedDataStore.save({
      teamId: "team-a",
      sourceType: "pulse-survey",
      uploadedAt: "2026-01-01T00:00:00.000Z",
      columnClassifications: {},
      rows: [],
    });

    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const defaultRes = await agent.get("/api/teams/team-a/analysis");
    expect(defaultRes.status).toBe(404); // no annual-survey data exists

    const pulseRes = await agent.get("/api/teams/team-a/analysis?source=pulse-survey");
    expect(pulseRes.status).toBe(200);
  });
});
