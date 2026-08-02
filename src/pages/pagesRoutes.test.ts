import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../app.js";
import { InMemoryTeamMappingStore } from "../teams/teamMappingStore.js";
import type { AuthenticatedHrbp, OidcClient } from "../auth/oidcClient.js";

class FakeOidcClient implements OidcClient {
  constructor(private readonly identitiesByCode: Record<string, AuthenticatedHrbp>) {}

  getAuthorizationUrl(state: string): string {
    return `https://knox.example.test/authorize?state=${state}`;
  }

  async exchangeCodeForTokens(code: string): Promise<AuthenticatedHrbp> {
    const identity = this.identitiesByCode[code];
    if (!identity) throw new Error(`no fake identity registered for code ${code}`);
    return identity;
  }
}

function buildTestApp() {
  const oidcClient = new FakeOidcClient({
    "code-for-hrbp-1": { hrbpId: "hrbp-1", name: "HRBP One" },
    "code-for-hrbp-unmapped": { hrbpId: "hrbp-unmapped" },
  });
  const teamMappingStore = new InMemoryTeamMappingStore([
    { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
    { teamId: "team-b", teamName: "Mobile Camera", hrbpId: "hrbp-1" },
  ]);
  const app = buildApp({ oidcClient, teamMappingStore, sessionSecret: "test-secret" });
  return { app };
}

async function loginAs(agent: ReturnType<typeof request.agent>, code: string) {
  const loginRes = await agent.get("/auth/login");
  const state = new URL(loginRes.headers.location, "https://knox.example.test").searchParams.get("state");
  await agent.get(`/auth/callback?code=${code}&state=${state}`);
}

describe("GET /", () => {
  it("shows a login link when not authenticated", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.text).toContain("/auth/login");
  });

  it("redirects to the dashboard when already authenticated", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "code-for-hrbp-1");

    const res = await agent.get("/");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/dashboard");
  });
});

describe("GET /dashboard", () => {
  it("redirects an unauthenticated visitor to the login page", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/dashboard");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  it("lists the authenticated HRBP's mapped teams", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "code-for-hrbp-1");

    const res = await agent.get("/dashboard");

    expect(res.status).toBe(200);
    expect(res.text).toContain("Backend Platform");
    expect(res.text).toContain("Mobile Camera");
  });

  it("links each team to its generated-ideas page", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "code-for-hrbp-1");

    const res = await agent.get("/dashboard");

    expect(res.text).toContain("/dashboard/teams/team-a/ideas");
    expect(res.text).toContain("/dashboard/teams/team-b/ideas");
  });

  it("shows an empty state for an HRBP with no mapped teams", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "code-for-hrbp-unmapped");

    const res = await agent.get("/dashboard");

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/no teams/i);
  });

  it("escapes team names to avoid HTML injection", async () => {
    const app = buildApp({
      oidcClient: new FakeOidcClient({ "code-1": { hrbpId: "hrbp-1" } }),
      teamMappingStore: new InMemoryTeamMappingStore([
        { teamId: "team-x", teamName: "<script>alert(1)</script>", hrbpId: "hrbp-1" },
      ]),
      sessionSecret: "test-secret",
    });
    const agent = request.agent(app);
    await loginAs(agent, "code-1");

    const res = await agent.get("/dashboard");

    expect(res.text).not.toContain("<script>alert(1)</script>");
    expect(res.text).toContain("&lt;script&gt;");
  });
});
