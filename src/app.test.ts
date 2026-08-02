import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "./app.js";
import { InMemoryTeamMappingStore } from "./teams/teamMappingStore.js";
import type { AuthenticatedHrbp, OidcClient } from "./auth/oidcClient.js";

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
    "code-for-hrbp-1": { hrbpId: "hrbp-1", email: "hrbp1@samsung.com" },
    "code-for-hrbp-unmapped": { hrbpId: "hrbp-unmapped" },
  });
  const teamMappingStore = new InMemoryTeamMappingStore([
    { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
    { teamId: "team-b", teamName: "Mobile Camera", hrbpId: "hrbp-1" },
    { teamId: "team-c", teamName: "Design Systems", hrbpId: "hrbp-2" },
  ]);
  const app = buildApp({ oidcClient, teamMappingStore, sessionSecret: "test-secret" });
  return { app, oidcClient, teamMappingStore };
}

/** Logs a test agent in as the given HRBP via the real login/callback routes. */
async function loginAs(agent: ReturnType<typeof request.agent>, code: string) {
  const loginRes = await agent.get("/auth/login");
  const state = new URL(loginRes.headers.location, "https://knox.example.test").searchParams.get("state");
  await agent.get(`/auth/callback?code=${code}&state=${state}`);
}

describe("GET /auth/login", () => {
  it("redirects to the OIDC provider's authorization URL", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/auth/login");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("https://knox.example.test/authorize");
  });
});

describe("GET /auth/callback", () => {
  it("rejects a callback whose state doesn't match the one issued at login", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await agent.get("/auth/login");

    const res = await agent.get("/auth/callback?code=code-for-hrbp-1&state=wrong-state");

    expect(res.status).toBe(400);
  });

  it("establishes an authenticated session on a valid callback", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);

    await loginAs(agent, "code-for-hrbp-1");
    const res = await agent.get("/api/teams");

    expect(res.status).toBe(200);
  });
});

describe("GET /api/teams", () => {
  it("rejects an unauthenticated request", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/api/teams");
    expect(res.status).toBe(401);
  });

  it("returns only the teams mapped to the authenticated HRBP", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "code-for-hrbp-1");

    const res = await agent.get("/api/teams");

    expect(res.status).toBe(200);
    expect(res.body.teams).toEqual([
      { teamId: "team-a", teamName: "Backend Platform" },
      { teamId: "team-b", teamName: "Mobile Camera" },
    ]);
  });

  it("returns an empty list for an HRBP with no mapped teams", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "code-for-hrbp-unmapped");

    const res = await agent.get("/api/teams");

    expect(res.status).toBe(200);
    expect(res.body.teams).toEqual([]);
  });
});

describe("GET /api/teams/:teamId", () => {
  it("rejects an unauthenticated request", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/api/teams/team-a");
    expect(res.status).toBe(401);
  });

  it("denies access to a team the HRBP isn't mapped to", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "code-for-hrbp-1");

    const res = await agent.get("/api/teams/team-c");

    expect(res.status).toBe(403);
  });

  it("allows access to a team the HRBP is mapped to", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "code-for-hrbp-1");

    const res = await agent.get("/api/teams/team-a");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ teamId: "team-a", teamName: "Backend Platform" });
  });
});
