import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../app.js";
import { InMemoryTeamMappingStore } from "../teams/teamMappingStore.js";
import type { AuthenticatedHrbp, OidcClient } from "./oidcClient.js";

class FakeOidcClient implements OidcClient {
  getAuthorizationUrl(state: string): string {
    return `https://knox.example.test/authorize?state=${state}`;
  }
  async exchangeCodeForTokens(): Promise<AuthenticatedHrbp> {
    throw new Error("not used in these tests");
  }
}

function buildTestApp(devLoginEnabled: boolean) {
  const teamMappingStore = new InMemoryTeamMappingStore([
    { teamId: "team-a", teamName: "Backend Platform", hrbpId: "tester@example.com" },
  ]);
  return buildApp({
    oidcClient: new FakeOidcClient(),
    teamMappingStore,
    sessionSecret: "test-secret",
    devLoginEnabled,
  });
}

describe("dev login (disabled by default)", () => {
  it("is not mounted when devLoginEnabled is false", async () => {
    const app = buildTestApp(false);
    const res = await request(app).get("/auth/dev-login");
    expect(res.status).toBe(404);
  });

  it("does not advertise itself on the landing page", async () => {
    const app = buildTestApp(false);
    const res = await request(app).get("/");
    expect(res.text).not.toContain("dev-login");
  });
});

describe("dev login (enabled)", () => {
  it("advertises itself on the landing page", async () => {
    const app = buildTestApp(true);
    const res = await request(app).get("/");
    expect(res.text).toContain("/auth/dev-login");
  });

  it("shows a form to enter an email", async () => {
    const app = buildTestApp(true);
    const res = await request(app).get("/auth/dev-login");
    expect(res.status).toBe(200);
    expect(res.text).toContain("<form");
    expect(res.text).toContain('type="email"');
  });

  it("logs in as the submitted email and reaches the dashboard with mapped teams", async () => {
    const app = buildTestApp(true);
    const agent = request.agent(app);

    const postRes = await agent
      .post("/auth/dev-login")
      .type("form")
      .send({ email: "tester@example.com" });
    expect(postRes.status).toBe(302);
    expect(postRes.headers.location).toBe("/dashboard");

    const dashboardRes = await agent.get("/dashboard");
    expect(dashboardRes.status).toBe(200);
    expect(dashboardRes.text).toContain("Backend Platform");
  });

  it("rejects an empty email", async () => {
    const app = buildTestApp(true);
    const res = await request(app).post("/auth/dev-login").type("form").send({ email: "" });
    expect(res.status).toBe(400);
  });
});
