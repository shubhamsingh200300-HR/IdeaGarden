import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

describe("manager routes (public, token-gated)", () => {
  let dir: string;
  let store: RequestIntakeStore;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "manager-routes-"));
    const key = randomBytes(32);
    store = new RequestIntakeStore(dir, key);
    const teamMappingStore = new InMemoryTeamMappingStore([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
    ]);
    app = buildApp({
      oidcClient: new FakeOidcClient(),
      teamMappingStore,
      sessionSecret: "test-secret",
      requestIntakeStore: store,
    });
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.useRealTimers();
  });

  it("shows a submission form for a valid, pending, unexpired token - no login required", async () => {
    const invite = store.createInvite("team-a", "hrbp-1");

    const res = await request(app).get(`/manager/requests/${invite.token}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("<form");
    expect(res.text).toContain("context");
  });

  it("shows a clear not-found error for an unknown token, not a form", async () => {
    const res = await request(app).get("/manager/requests/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.text).not.toContain("<form");
    expect(res.text.toLowerCase()).toMatch(/not found|invalid/);
  });

  it("shows a clear expired error for an expired token", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const invite = store.createInvite("team-a", "hrbp-1", 1000 * 60 * 60);
    vi.setSystemTime(new Date("2026-01-01T02:00:00.000Z"));

    const res = await request(app).get(`/manager/requests/${invite.token}`);

    expect(res.status).toBe(410);
    expect(res.text.toLowerCase()).toContain("expired");
  });

  it("shows a clear already-submitted error for a reused token", async () => {
    const invite = store.createInvite("team-a", "hrbp-1");
    store.submitByToken(invite.token!, "Already submitted.", {
      budget: "",
      time: "",
      headcountLogistics: "",
    });

    const res = await request(app).get(`/manager/requests/${invite.token}`);

    expect(res.status).toBe(409);
    expect(res.text.toLowerCase()).toContain("already");
  });

  it("submits context and constraints, marking the request submitted", async () => {
    const invite = store.createInvite("team-a", "hrbp-1");

    const res = await request(app)
      .post(`/manager/requests/${invite.token}`)
      .type("form")
      .send({
        context: "The team shipped a rough launch last quarter and morale is a bit low.",
        budget: "up to 50,000 INR",
        time: "half a day max",
        headcountLogistics: "team of 8",
      });

    expect(res.status).toBe(200);
    expect(res.text.toLowerCase()).toContain("thank");

    const stored = store.getLatest("team-a");
    expect(stored?.status).toBe("submitted");
    expect(stored?.context).toContain("rough launch");
    expect(stored?.constraints.budget).toBe("up to 50,000 INR");
  });

  it("rejects a submission with no context, without consuming the token", async () => {
    const invite = store.createInvite("team-a", "hrbp-1");

    const res = await request(app).post(`/manager/requests/${invite.token}`).type("form").send({ context: "" });

    expect(res.status).toBe(400);
    expect(store.getLatest("team-a")?.status).toBe("pending");
  });

  it("rejects a submission for an unknown token", async () => {
    const res = await request(app)
      .post("/manager/requests/does-not-exist")
      .type("form")
      .send({ context: "Some context." });

    expect(res.status).toBe(404);
  });

  it("rejects a resubmission for an already-used token", async () => {
    const invite = store.createInvite("team-a", "hrbp-1");
    store.submitByToken(invite.token!, "First.", { budget: "", time: "", headcountLogistics: "" });

    const res = await request(app)
      .post(`/manager/requests/${invite.token}`)
      .type("form")
      .send({ context: "Second attempt." });

    expect(res.status).toBe(409);
  });
});
