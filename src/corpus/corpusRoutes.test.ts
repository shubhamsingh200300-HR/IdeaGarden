import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import type { AuthenticatedHrbp, OidcClient } from "../auth/oidcClient.js";
import { InMemoryTeamMappingStore } from "../teams/teamMappingStore.js";
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

function validProposalBody(overrides: Record<string, unknown> = {}) {
  return {
    company: "Figma",
    initiative: "Design Critique Fridays",
    primarySignal: "growth/mastery",
    secondarySignals: ["recognition"],
    structure: "A weekly open critique session where any designer can present in-progress work.",
    impactEvidence: "No public quantitative data found.",
    sources: ["https://figma.com/blog/design-critique — first-party description of the ritual"],
    ...overrides,
  };
}

describe("corpus routes", () => {
  let dir: string;

  function buildTestApp() {
    const key = randomBytes(32);
    const teamMappingStore = new InMemoryTeamMappingStore([]);
    const proposalStore = new CorpusProposalStore(join(dir, "proposals"), key);
    const vectorStore = new OnPremVectorStore([]);
    const corpusFilePath = join(dir, "benchmark-corpus.md");
    writeFileSync(corpusFilePath, "# Benchmark corpus\n\n## Autonomy & Ownership\n");

    const app = buildApp({
      oidcClient: new FakeOidcClient(),
      teamMappingStore,
      sessionSecret: "test-secret",
      devLoginEnabled: true,
      corpusDeps: { proposalStore, vectorStore, corpusFilePath },
    });
    return { app, proposalStore, vectorStore, corpusFilePath };
  }

  async function loginAs(agent: ReturnType<typeof request.agent>, email: string) {
    await agent.post("/auth/dev-login").type("form").send({ email });
  }

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "corpus-routes-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  describe("POST /api/corpus/proposals", () => {
    it("rejects an unauthenticated request", async () => {
      const { app } = buildTestApp();
      const res = await request(app).post("/api/corpus/proposals").send(validProposalBody());
      expect(res.status).toBe(401);
    });

    it("accepts a well-sourced proposal as pending", async () => {
      const { app } = buildTestApp();
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");

      const res = await agent.post("/api/corpus/proposals").send(validProposalBody());

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("pending");
      expect(res.body.entry.id).toBe("figma-design-critique-fridays");
    });

    it("returns 400 with the issues for a proposal with no sources", async () => {
      const { app } = buildTestApp();
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");

      const res = await agent.post("/api/corpus/proposals").send(validProposalBody({ sources: [] }));

      expect(res.status).toBe(400);
      expect(res.body.issues.length).toBeGreaterThan(0);
    });
  });

  describe("GET /api/corpus/proposals", () => {
    it("rejects an unauthenticated request", async () => {
      const { app } = buildTestApp();
      const res = await request(app).get("/api/corpus/proposals");
      expect(res.status).toBe(401);
    });

    it("filters to pending proposals with ?status=pending", async () => {
      const { app, proposalStore } = buildTestApp();
      const proposed = proposalStore.propose(validProposalBody());
      if (proposed.status !== "ok") throw new Error("expected ok");
      proposalStore.decide(proposed.proposal.entry.id, "rejected");
      proposalStore.propose(validProposalBody({ company: "Stripe", initiative: "Writing Culture" }));

      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");
      const res = await agent.get("/api/corpus/proposals?status=pending");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].entry.company).toBe("Stripe");
    });
  });

  describe("POST /api/corpus/proposals/:entryId/approve", () => {
    it("rejects an unauthenticated request", async () => {
      const { app } = buildTestApp();
      const res = await request(app).post("/api/corpus/proposals/some-id/approve");
      expect(res.status).toBe(401);
    });

    it("returns 404 for an id that was never proposed", async () => {
      const { app } = buildTestApp();
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");

      const res = await agent.post("/api/corpus/proposals/nonexistent/approve");
      expect(res.status).toBe(404);
    });

    it("approves the proposal and makes it retrievable through the vector store immediately", async () => {
      const { app, proposalStore, vectorStore } = buildTestApp();
      const proposed = proposalStore.propose(validProposalBody());
      if (proposed.status !== "ok") throw new Error("expected ok");
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");

      const res = await agent.post(`/api/corpus/proposals/${proposed.proposal.entry.id}/approve`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(proposed.proposal.entry.id);
      const retrieved = vectorStore.retrieveBySignal("growth/mastery", "design critique");
      expect(retrieved.map((e) => e.id)).toContain(proposed.proposal.entry.id);
    });

    it("returns 409 when approving an already-decided proposal", async () => {
      const { app, proposalStore } = buildTestApp();
      const proposed = proposalStore.propose(validProposalBody());
      if (proposed.status !== "ok") throw new Error("expected ok");
      proposalStore.decide(proposed.proposal.entry.id, "rejected");
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");

      const res = await agent.post(`/api/corpus/proposals/${proposed.proposal.entry.id}/approve`);
      expect(res.status).toBe(409);
    });
  });

  describe("POST /api/corpus/proposals/:entryId/reject", () => {
    it("rejects an unauthenticated request", async () => {
      const { app } = buildTestApp();
      const res = await request(app).post("/api/corpus/proposals/some-id/reject");
      expect(res.status).toBe(401);
    });

    it("marks the proposal rejected, and it never becomes retrievable", async () => {
      const { app, proposalStore, vectorStore } = buildTestApp();
      const proposed = proposalStore.propose(validProposalBody());
      if (proposed.status !== "ok") throw new Error("expected ok");
      const agent = request.agent(app);
      await loginAs(agent, "hrbp-1");

      const res = await agent.post(`/api/corpus/proposals/${proposed.proposal.entry.id}/reject`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("rejected");
      expect(vectorStore.retrieveBySignal("growth/mastery", "design critique")).toEqual([]);
    });
  });
});
