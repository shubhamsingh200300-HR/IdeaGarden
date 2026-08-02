import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { AuthenticatedHrbp, OidcClient } from "../auth/oidcClient.js";
import { InMemoryTeamMappingStore } from "../teams/teamMappingStore.js";
import { RequestIntakeStore } from "./requestIntakeStore.js";

class FakeOidcClient implements OidcClient {
  getAuthorizationUrl(state: string): string {
    return `https://knox.example.test/authorize?state=${state}`;
  }
  async exchangeCodeForTokens(): Promise<AuthenticatedHrbp> {
    throw new Error("not used in these tests");
  }
}

describe("request intake routes (HRBP-facing)", () => {
  let dir: string;

  function buildTestApp() {
    const key = randomBytes(32);
    const teamMappingStore = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
      { teamId: "team-c", teamName: "Design Systems", hrbpId: "hrbp-2" },
    ]);
    const requestIntakeStore = new RequestIntakeStore(dir, key);
    const app = buildApp({
      oidcClient: new FakeOidcClient(),
      teamMappingStore,
      sessionSecret: "test-secret",
      devLoginEnabled: true,
      requestIntakeStore,
    });
    return { app, requestIntakeStore };
  }

  async function loginAs(agent: ReturnType<typeof request.agent>, email: string) {
    await agent.post("/auth/dev-login").type("form").send({ email });
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "request-routes-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("POST /:teamId/requests/invite", () => {
    it("rejects an unauthenticated invite creation", async () => {
      const { app } = buildTestApp();
      const res = await request(app).post("/api/teams/team-a/requests/invite");
      expect(res.status).toBe(401);
    });

    it("rejects invite creation for a team the HRBP isn't authorized for", async () => {
      const { app } = buildTestApp();
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");

      const res = await agent.post("/api/teams/team-c/requests/invite");
      expect(res.status).toBe(403);
    });

    it("creates a pending invite and returns a manager link", async () => {
      const { app } = buildTestApp();
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");

      const res = await agent.post("/api/teams/team-a/requests/invite");

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("pending");
      expect(res.body.teamId).toBe("team-a");
      expect(res.body.link).toContain("/manager/requests/");
      expect(res.body.link).toContain(res.body.token);
    });
  });

  describe("GET /:teamId/requests/latest", () => {
    it("rejects an unauthenticated request", async () => {
      const { app } = buildTestApp();
      const res = await request(app).get("/api/teams/team-a/requests/latest");
      expect(res.status).toBe(401);
    });

    it("rejects retrieval for a team the HRBP isn't authorized for", async () => {
      const { app } = buildTestApp();
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");

      const res = await agent.get("/api/teams/team-c/requests/latest");
      expect(res.status).toBe(403);
    });

    it("returns 404 when no invite has been created for the team yet", async () => {
      const { app } = buildTestApp();
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");

      const res = await agent.get("/api/teams/team-a/requests/latest");
      expect(res.status).toBe(404);
    });

    it("reflects pending status right after an invite is created", async () => {
      const { app } = buildTestApp();
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");
      await agent.post("/api/teams/team-a/requests/invite");

      const res = await agent.get("/api/teams/team-a/requests/latest");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("pending");
    });

    it("reflects submitted status once the manager has responded", async () => {
      const { app, requestIntakeStore } = buildTestApp();
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");
      const inviteRes = await agent.post("/api/teams/team-a/requests/invite");

      requestIntakeStore.submitByToken(inviteRes.body.token, "Manager's context here.", {
        budget: "",
        time: "",
        headcountLogistics: "",
      });

      const res = await agent.get("/api/teams/team-a/requests/latest");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("submitted");
      expect(res.body.context).toBe("Manager's context here.");
    });
  });

  it("full flow end to end over real HTTP: HRBP invites, manager submits via the link, HRBP sees it submitted", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const inviteRes = await agent.post("/api/teams/team-a/requests/invite");
    expect(inviteRes.status).toBe(201);
    const managerPath = new URL(inviteRes.body.link).pathname;

    const submitRes = await request(app)
      .post(managerPath)
      .type("form")
      .send({
        context: "The team shipped a rough launch last quarter and morale is a bit low.",
        budget: "up to 50,000 INR",
        time: "half a day max",
        headcountLogistics: "team of 8",
      });
    expect(submitRes.status).toBe(200);

    const latestRes = await agent.get("/api/teams/team-a/requests/latest");
    expect(latestRes.status).toBe(200);
    expect(latestRes.body.status).toBe("submitted");
    expect(latestRes.body.context).toContain("rough launch");
    expect(latestRes.body.constraints.budget).toBe("up to 50,000 INR");
  });
});
