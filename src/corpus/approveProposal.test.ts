import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseBenchmarkCorpus } from "./parseBenchmarkCorpus.js";
import { OnPremVectorStore } from "./vectorStore.js";
import { CorpusProposalStore } from "./corpusProposalStore.js";
import { approveProposal } from "./approveProposal.js";

function proposedEntry() {
  return {
    company: "Figma",
    initiative: "Design Critique Fridays",
    primarySignal: "growth/mastery",
    secondarySignals: ["recognition"],
    structure: "A weekly open critique session where any designer can present in-progress work.",
    impactEvidence: "No public quantitative data found.",
    sources: ["https://figma.com/blog/design-critique — first-party description of the ritual"],
  };
}

describe("approveProposal", () => {
  let dir: string;
  let corpusFilePath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "approve-proposal-"));
    corpusFilePath = join(dir, "benchmark-corpus.md");
    writeFileSync(corpusFilePath, "# Benchmark corpus\n\n## Autonomy & Ownership\n");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns not-found for an id that was never proposed", () => {
    const proposalStore = new CorpusProposalStore(dir, randomBytes(32));
    const vectorStore = new OnPremVectorStore([]);

    const result = approveProposal({ proposalStore, vectorStore, corpusFilePath }, "nonexistent");

    expect(result.status).toBe("not-found");
  });

  it("adds the entry to the vector store immediately, making it retrievable with no restart", () => {
    const proposalStore = new CorpusProposalStore(dir, randomBytes(32));
    const vectorStore = new OnPremVectorStore([]);
    const proposed = proposalStore.propose(proposedEntry());
    if (proposed.status !== "ok") throw new Error("expected ok");

    const result = approveProposal({ proposalStore, vectorStore, corpusFilePath }, proposed.proposal.entry.id);

    expect(result.status).toBe("ok");
    const retrieved = vectorStore.retrieveBySignal("growth/mastery", "design critique");
    expect(retrieved.map((e) => e.id)).toContain(proposed.proposal.entry.id);
  });

  it("appends the entry to the corpus file so it survives a restart", () => {
    const proposalStore = new CorpusProposalStore(dir, randomBytes(32));
    const vectorStore = new OnPremVectorStore([]);
    const proposed = proposalStore.propose(proposedEntry());
    if (proposed.status !== "ok") throw new Error("expected ok");

    approveProposal({ proposalStore, vectorStore, corpusFilePath }, proposed.proposal.entry.id);

    const onDisk = parseBenchmarkCorpus(readFileSync(corpusFilePath, "utf-8"));
    expect(onDisk.map((e) => e.id)).toContain(proposed.proposal.entry.id);
  });

  it("marks the proposal approved in the store", () => {
    const proposalStore = new CorpusProposalStore(dir, randomBytes(32));
    const vectorStore = new OnPremVectorStore([]);
    const proposed = proposalStore.propose(proposedEntry());
    if (proposed.status !== "ok") throw new Error("expected ok");

    approveProposal({ proposalStore, vectorStore, corpusFilePath }, proposed.proposal.entry.id);

    expect(proposalStore.listAll()[0].status).toBe("approved");
  });

  it("refuses to approve an already-decided proposal a second time", () => {
    const proposalStore = new CorpusProposalStore(dir, randomBytes(32));
    const vectorStore = new OnPremVectorStore([]);
    const proposed = proposalStore.propose(proposedEntry());
    if (proposed.status !== "ok") throw new Error("expected ok");
    proposalStore.decide(proposed.proposal.entry.id, "rejected");

    const result = approveProposal({ proposalStore, vectorStore, corpusFilePath }, proposed.proposal.entry.id);

    expect(result.status).toBe("already-decided");
  });

  it("never adds a rejected proposal to the vector store", () => {
    const proposalStore = new CorpusProposalStore(dir, randomBytes(32));
    const vectorStore = new OnPremVectorStore([]);
    const proposed = proposalStore.propose(proposedEntry());
    if (proposed.status !== "ok") throw new Error("expected ok");

    proposalStore.decide(proposed.proposal.entry.id, "rejected");

    expect(vectorStore.retrieveBySignal("growth/mastery", "design critique")).toEqual([]);
  });
});
