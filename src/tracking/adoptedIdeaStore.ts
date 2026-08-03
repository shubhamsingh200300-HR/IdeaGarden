import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Sentiment } from "../analysis/llmClient.js";
import type { PublicIdeaCard } from "../generation/generateIdeas.js";
import { decryptFromFile, encryptToFile } from "../uploads/encryptedFile.js";

export interface SignalSnapshot {
  count: number;
  sentiment: Sentiment;
}

export interface AdoptionOutcome {
  comparedAt: string;
  /** Null means the signal no longer surfaced at all in the next cycle's analysis - the best possible outcome, not a missing measurement. */
  after: SignalSnapshot | null;
  improved: boolean;
}

export interface AdoptedIdea {
  id: string;
  teamId: string;
  idea: PublicIdeaCard;
  adoptedAt: string;
  /** Null only when no survey data existed yet to establish one at adoption time. */
  baseline: SignalSnapshot | null;
  outcome: AdoptionOutcome | null;
}

/**
 * On-prem, per-team-scoped, append-only record of adopted ideas and their
 * next-cycle outcomes (ticket 08). Unlike GeneratedIdeasStore/
 * DerivedDataStore's "latest wins" pattern, full history is kept here on
 * purpose: this is the record both the HRBP-facing comparison (ticket 08's
 * third checkbox) and the per-team ranking feedback loop (its fourth) read
 * from.
 */
export class AdoptedIdeaStore {
  constructor(
    private readonly baseDir: string,
    private readonly key: Buffer,
  ) {}

  adopt(teamId: string, idea: PublicIdeaCard, baseline: SignalSnapshot | null): AdoptedIdea {
    const record: AdoptedIdea = {
      id: randomUUID(),
      teamId,
      idea,
      adoptedAt: new Date().toISOString(),
      baseline,
      outcome: null,
    };

    const all = this.list(teamId);
    all.push(record);
    this.save(teamId, all);

    return record;
  }

  list(teamId: string): AdoptedIdea[] {
    const filePath = this.filePath(teamId);
    if (!existsSync(filePath)) return [];
    return JSON.parse(decryptFromFile(filePath, this.key).toString()) as AdoptedIdea[];
  }

  pendingOutcomes(teamId: string): AdoptedIdea[] {
    return this.list(teamId).filter((record) => record.outcome === null);
  }

  recordOutcome(teamId: string, id: string, after: SignalSnapshot | null, improved: boolean): void {
    const all = this.list(teamId);
    const index = all.findIndex((record) => record.id === id);
    if (index === -1) return;

    all[index] = {
      ...all[index],
      outcome: { comparedAt: new Date().toISOString(), after, improved },
    };
    this.save(teamId, all);
  }

  private save(teamId: string, records: AdoptedIdea[]): void {
    const dir = join(this.baseDir, teamId);
    mkdirSync(dir, { recursive: true });
    encryptToFile(this.filePath(teamId), Buffer.from(JSON.stringify(records)), this.key);
  }

  private filePath(teamId: string): string {
    return join(this.baseDir, teamId, "records.enc");
  }
}
