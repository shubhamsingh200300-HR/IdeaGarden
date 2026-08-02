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

describe("request intake routes", () => {
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

  it("rejects an unauthenticated submission", async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post("/api/teams/team-a/requests")
      .send({ context: "Team morale is a bit low after a rough launch." });

    expect(res.status).toBe(401);
  });

  it("rejects a submission for a team the HRBP isn't authorized for", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent
      .post("/api/teams/team-c/requests")
      .send({ context: "Some context." });

    expect(res.status).toBe(403);
  });

  it("rejects a submission with no context", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.post("/api/teams/team-a/requests").send({ context: "" });

    expect(res.status).toBe(400);
  });

  it("submits a request with context and constraints, retrievable scoped to the correct team", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const submitRes = await agent.post("/api/teams/team-a/requests").send({
      context: "The team shipped a rough launch last quarter and morale is a bit low.",
      constraints: { budget: "up to 50,000 INR", time: "half a day max", headcountLogistics: "team of 8" },
    });

    expect(submitRes.status).toBe(201);
    expect(submitRes.body.teamId).toBe("team-a");
    expect(submitRes.body.hrbpId).toBe("hrbp-1");

    const getRes = await agent.get("/api/teams/team-a/requests/latest");
    expect(getRes.status).toBe(200);
    expect(getRes.body.context).toContain("rough launch");
    expect(getRes.body.constraints.budget).toBe("up to 50,000 INR");
  });

  it("submits successfully with no constraints given, defaulting them to empty", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.post("/api/teams/team-a/requests").send({ context: "Just some context." });

    expect(res.status).toBe(201);
    expect(res.body.constraints).toEqual({ budget: "", time: "", headcountLogistics: "" });
  });

  it("rejects a non-string constraint field instead of silently dropping it", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent
      .post("/api/teams/team-a/requests")
      .send({ context: "Some context.", constraints: { budget: 50000 } });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/budget/i);
  });

  it("checks team authorization before parsing the request body (403 even with a body too large to parse cheaply)", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    // hrbp-1 isn't authorized for team-c - this must 403 regardless of body content.
    const res = await agent
      .post("/api/teams/team-c/requests")
      .send({ context: "x".repeat(1000), constraints: { budget: "x".repeat(1000) } });

    expect(res.status).toBe(403);
  });

  it("rejects retrieval for a team the HRBP isn't authorized for", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.get("/api/teams/team-c/requests/latest");
    expect(res.status).toBe(403);
  });

  it("returns 404 when no request has been submitted for the team yet", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.get("/api/teams/team-a/requests/latest");
    expect(res.status).toBe(404);
  });
});
