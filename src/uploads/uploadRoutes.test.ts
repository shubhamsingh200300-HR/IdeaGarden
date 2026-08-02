import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { AuthenticatedHrbp, OidcClient } from "../auth/oidcClient.js";
import { InMemoryTeamMappingStore } from "../teams/teamMappingStore.js";
import { FileAuditLog } from "./auditLog.js";
import { DerivedDataStore } from "./derivedDataStore.js";
import { EncryptedFileSystemStore } from "./rawFileStore.js";
import { buildXlsx } from "./testFixtures.js";

class FakeOidcClient implements OidcClient {
  getAuthorizationUrl(state: string): string {
    return `https://knox.example.test/authorize?state=${state}`;
  }
  async exchangeCodeForTokens(): Promise<AuthenticatedHrbp> {
    throw new Error("not used in these tests");
  }
}

describe("upload routes", () => {
  let dir: string;

  function buildTestApp() {
    const key = randomBytes(32);
    const teamMappingStore = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
      { teamId: "team-c", teamName: "Design Systems", hrbpId: "hrbp-2" },
    ]);
    const ingestDeps = {
      rawFileStore: new EncryptedFileSystemStore(join(dir, "raw"), key),
      derivedDataStore: new DerivedDataStore(join(dir, "derived"), key),
      auditLog: new FileAuditLog(join(dir, "audit.log")),
    };
    const app = buildApp({
      oidcClient: new FakeOidcClient(),
      teamMappingStore,
      sessionSecret: "test-secret",
      devLoginEnabled: true,
      ingestDeps,
    });
    return { app, ingestDeps };
  }

  async function loginAs(agent: ReturnType<typeof request.agent>, email: string) {
    await agent.post("/auth/dev-login").type("form").send({ email });
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "upload-routes-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("rejects an unauthenticated upload", async () => {
    const { app } = buildTestApp();
    const buffer = await buildXlsx(["Department"], [["Engineering"]]);

    const res = await request(app)
      .post("/api/teams/team-a/uploads/annual-survey")
      .attach("file", buffer, "survey.xlsx");

    expect(res.status).toBe(401);
  });

  it("rejects an upload for a team the HRBP isn't authorized for", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");
    const buffer = await buildXlsx(["Department"], [["Engineering"]]);

    const res = await agent.post("/api/teams/team-c/uploads/annual-survey").attach("file", buffer, "survey.xlsx");

    expect(res.status).toBe(403);
  });

  it("requires a file to be attached", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent.post("/api/teams/team-a/uploads/annual-survey");

    expect(res.status).toBe(400);
  });

  it("processes a well-formed annual survey upload for an authorized team", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");
    const buffer = await buildXlsx(
      ["Department", "Comments"],
      [["Engineering", "The onboarding experience could use more structure honestly."]],
    );

    const res = await agent
      .post("/api/teams/team-a/uploads/annual-survey")
      .attach("file", buffer, "survey.xlsx");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("processed");
    expect(res.body.cleanRowCount).toBe(1);
  });

  it("returns 422 with the ambiguous columns when a column can't be classified confidently", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");
    const buffer = await buildXlsx(
      ["Field3"],
      [
        ["Mostly satisfied with current role and team dynamics overall this year"],
        ["3"],
        ["Neutral"],
        ["Somewhat, but depends on the project honestly speaking"],
      ],
    );

    const res = await agent.post("/api/teams/team-a/uploads/annual-survey").attach("file", buffer, "survey.xlsx");

    expect(res.status).toBe(422);
    expect(res.body.ambiguousColumns).toEqual(["Field3"]);
  });

  it("returns a clean 400 for a file exceeding the size limit, not a generic server error", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");
    const oversized = Buffer.alloc(26 * 1024 * 1024, "x");

    const res = await agent
      .post("/api/teams/team-a/uploads/annual-survey")
      .attach("file", oversized, "huge.xlsx");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("upload rejected");
  });

  it("returns 400 with a clear reason for a malformed file", async () => {
    const { app } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");

    const res = await agent
      .post("/api/teams/team-a/uploads/annual-survey")
      .attach("file", Buffer.from("not a spreadsheet"), "survey.xlsx");

    expect(res.status).toBe(400);
    expect(res.body.reason).toMatch(/could not be read/i);
  });

  it("routes pulse-survey and exit-data uploads to their own source type", async () => {
    const { app, ingestDeps } = buildTestApp();
    const agent = request.agent(app);
    await loginAs(agent, "hrbp-1");
    const buffer = await buildXlsx(["Department"], [["Engineering"]]);

    await agent.post("/api/teams/team-a/uploads/pulse-survey").attach("file", buffer, "pulse.xlsx");
    await agent.post("/api/teams/team-a/uploads/exit-data").attach("file", buffer, "exit.xlsx");

    expect(ingestDeps.derivedDataStore.getLatest("team-a", "pulse-survey")).toBeDefined();
    expect(ingestDeps.derivedDataStore.getLatest("team-a", "exit-data")).toBeDefined();
    expect(ingestDeps.derivedDataStore.getLatest("team-a", "annual-survey")).toBeUndefined();
  });
});
