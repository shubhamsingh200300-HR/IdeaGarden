import { appendCorpusEntry } from "./corpusFile.js";
import type { CorpusProposalStore } from "./corpusProposalStore.js";
import type { CorpusEntry } from "./parseBenchmarkCorpus.js";
import type { OnPremVectorStore } from "./vectorStore.js";

export interface ApproveProposalDeps {
  proposalStore: CorpusProposalStore;
  vectorStore: OnPremVectorStore;
  /** The same file loadCorpus.ts reads at startup - see corpusFile.ts for why appending here matters. */
  corpusFilePath: string;
}

export type ApproveProposalResult =
  | { status: "not-found" }
  | { status: "already-decided" }
  | { status: "ok"; entry: CorpusEntry };

/**
 * Ticket 09's third checkbox: approving triggers re-indexing immediately,
 * not on a periodic schedule. `vectorStore.addEntry` mutates the same
 * OnPremVectorStore instance every RunGenerationDeps.vectorStore reference
 * already points at (see vectorStore.ts), so the very next generation
 * request sees the new entry with no restart. Also appended to the corpus
 * markdown file so the addition survives a process restart.
 */
export function approveProposal(deps: ApproveProposalDeps, entryId: string): ApproveProposalResult {
  const decided = deps.proposalStore.decide(entryId, "approved");
  if (decided.status !== "ok") return decided;

  deps.vectorStore.addEntry(decided.proposal.entry);
  appendCorpusEntry(deps.corpusFilePath, decided.proposal.entry);

  return { status: "ok", entry: decided.proposal.entry };
}
