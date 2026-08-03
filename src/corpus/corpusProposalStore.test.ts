import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CorpusEntry } from "./parseBenchmarkCorpus.js";
import { CorpusProposalStore } from "./corpusProposalStore.js";

function proposedEntry(overrides: Partial<Omit<CorpusEntry, "id">> = {}): Omit<CorpusEntry, "id"> {
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

describe("CorpusProposalStore", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "corpus-proposal-store-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("starts with no proposals", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));
    expect(store.listAll()).toEqual([]);
  });

  it("accepts a sourced proposal as pending", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));

    const result = store.propose(proposedEntry());

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.proposal.status).toBe("pending");
    expect(result.proposal.decidedAt).toBeNull();
    expect(result.proposal.entry.company).toBe("Figma");
    expect(result.proposal.entry.id).toBe("figma-design-critique-fridays");
  });

  it("rejects a proposal with no sources at all - no unsourced claims", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));

    const result = store.propose(proposedEntry({ sources: [] }));

    expect(result.status).toBe("invalid");
    if (result.status !== "invalid") throw new Error("expected invalid");
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("rejects a proposal whose sources don't look like citations (no URL)", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));

    const result = store.propose(proposedEntry({ sources: ["everyone knows this is true"] }));

    expect(result.status).toBe("invalid");
  });

  it("does not persist an invalid proposal", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));
    store.propose(proposedEntry({ sources: [] }));

    expect(store.listAll()).toEqual([]);
  });

  it("gives a second proposal for the same company/initiative a distinct id", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));
    const first = store.propose(proposedEntry());
    const second = store.propose(proposedEntry());

    if (first.status !== "ok" || second.status !== "ok") throw new Error("expected ok");
    expect(first.proposal.entry.id).not.toBe(second.proposal.entry.id);
  });

  it("avoids colliding with ids passed in as already used by the live corpus", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));

    const result = store.propose(proposedEntry(), ["figma-design-critique-fridays"]);

    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.proposal.entry.id).toBe("figma-design-critique-fridays-2");
  });

  it("persists proposals across store instances", () => {
    const key = randomBytes(32);
    new CorpusProposalStore(dir, key).propose(proposedEntry());

    const reopened = new CorpusProposalStore(dir, key);
    expect(reopened.listAll()).toHaveLength(1);
  });

  it("lists only pending proposals from listPending", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));
    const proposal = store.propose(proposedEntry());
    if (proposal.status !== "ok") throw new Error("expected ok");
    store.propose(proposedEntry({ company: "Stripe", initiative: "Writing Culture" }));

    store.decide(proposal.proposal.entry.id, "approved");

    const pending = store.listPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].entry.company).toBe("Stripe");
  });

  it("approves a pending proposal, stamping decidedAt", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));
    const proposal = store.propose(proposedEntry());
    if (proposal.status !== "ok") throw new Error("expected ok");

    const result = store.decide(proposal.proposal.entry.id, "approved");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.proposal.status).toBe("approved");
    expect(result.proposal.decidedAt).not.toBeNull();
  });

  it("rejects a pending proposal", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));
    const proposal = store.propose(proposedEntry());
    if (proposal.status !== "ok") throw new Error("expected ok");

    const result = store.decide(proposal.proposal.entry.id, "rejected");

    expect(result.status).toBe("ok");
    if (result.status !== "ok") throw new Error("expected ok");
    expect(result.proposal.status).toBe("rejected");
  });

  it("returns not-found for an id that was never proposed", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));
    expect(store.decide("nonexistent", "approved").status).toBe("not-found");
  });

  it("refuses to re-decide an already-decided proposal, not silently retrying it", () => {
    const store = new CorpusProposalStore(dir, randomBytes(32));
    const proposal = store.propose(proposedEntry());
    if (proposal.status !== "ok") throw new Error("expected ok");
    store.decide(proposal.proposal.entry.id, "rejected");

    const secondAttempt = store.decide(proposal.proposal.entry.id, "approved");

    expect(secondAttempt.status).toBe("already-decided");
    expect(store.listAll()[0].status).toBe("rejected"); // unchanged
  });
});
