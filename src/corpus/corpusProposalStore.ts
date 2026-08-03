import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { decryptFromFile, encryptToFile } from "../uploads/encryptedFile.js";
import { generateUniqueEntryId } from "./corpusSlug.js";
import type { CorpusEntry } from "./parseBenchmarkCorpus.js";

export type ProposalStatus = "pending" | "approved" | "rejected";

export interface CorpusProposal {
  entry: CorpusEntry;
  status: ProposalStatus;
  proposedAt: string;
  decidedAt: string | null;
}

export type ProposeResult = { status: "invalid"; issues: string[] } | { status: "ok"; proposal: CorpusProposal };

export type DecideResult =
  | { status: "not-found" }
  | { status: "already-decided" }
  | { status: "ok"; proposal: CorpusProposal };

/** A rough, structural proxy for "primary sources or named, attributed press; no unsourced claims" - real editorial judgment on source quality still happens in human review (ticket 09's second checkbox), this only catches the unambiguous case of no citation at all. */
function validateSources(sources: string[]): string[] {
  const issues: string[] = [];
  if (sources.length === 0) {
    issues.push("at least one source is required - no unsourced claims");
  } else if (sources.some((source) => !source.includes("http"))) {
    issues.push("every source must cite a URL");
  }
  return issues;
}

/**
 * On-prem, global (not per-team) store for agent-proposed candidate corpus
 * entries (ticket 09). Corpus content is public benchmark research, not
 * employee data, but this still follows the same encrypted-file pattern as
 * every other store here for a single, consistent storage posture.
 *
 * Unlike GeneratedIdeasStore/DerivedDataStore's "latest wins" pattern, all
 * proposals are kept (pending, approved, and rejected) as one durable
 * append-mostly log - a rejected proposal is marked, never deleted, so it's
 * visibly discarded rather than silently vanishing or being retried.
 */
export class CorpusProposalStore {
  constructor(
    private readonly baseDir: string,
    private readonly key: Buffer,
  ) {}

  listAll(): CorpusProposal[] {
    const filePath = this.filePath();
    if (!existsSync(filePath)) return [];
    return JSON.parse(decryptFromFile(filePath, this.key).toString()) as CorpusProposal[];
  }

  listPending(): CorpusProposal[] {
    return this.listAll().filter((proposal) => proposal.status === "pending");
  }

  propose(input: Omit<CorpusEntry, "id">, existingCorpusIds: Iterable<string> = []): ProposeResult {
    const issues = validateSources(input.sources);
    if (issues.length > 0) return { status: "invalid", issues };

    const all = this.listAll();
    const usedIds = new Set([...existingCorpusIds, ...all.map((proposal) => proposal.entry.id)]);
    const id = generateUniqueEntryId(input.company, input.initiative, usedIds);

    const proposal: CorpusProposal = {
      entry: { id, ...input },
      status: "pending",
      proposedAt: new Date().toISOString(),
      decidedAt: null,
    };

    all.push(proposal);
    this.save(all);

    return { status: "ok", proposal };
  }

  decide(entryId: string, status: "approved" | "rejected"): DecideResult {
    const all = this.listAll();
    const index = all.findIndex((proposal) => proposal.entry.id === entryId);
    if (index === -1) return { status: "not-found" };
    if (all[index].status !== "pending") return { status: "already-decided" };

    all[index] = { ...all[index], status, decidedAt: new Date().toISOString() };
    this.save(all);

    return { status: "ok", proposal: all[index] };
  }

  private save(proposals: CorpusProposal[]): void {
    mkdirSync(this.baseDir, { recursive: true });
    encryptToFile(this.filePath(), Buffer.from(JSON.stringify(proposals)), this.key);
  }

  private filePath(): string {
    return join(this.baseDir, "proposals.enc");
  }
}
