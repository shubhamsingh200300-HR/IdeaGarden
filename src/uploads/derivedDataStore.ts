import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ColumnClassification } from "./columnClassifier.js";
import { decryptFromFile, encryptToFile } from "./encryptedFile.js";
import type { SourceType } from "./rawFileStore.js";

export interface ProcessedRow {
  status: "clean" | "quarantined";
  values: Record<string, string>;
  quarantineReasons?: string[];
}

export interface ProcessedUpload {
  teamId: string;
  sourceType: SourceType;
  uploadedAt: string;
  columnClassifications: Record<string, ColumnClassification>;
  rows: ProcessedRow[];
}

/**
 * On-prem storage for derived/processed upload data, kept separate from
 * the raw file tier (rawFileStore.ts) per the different retention rules:
 * this data is not deleted when a new cycle's raw file supersedes the old
 * one (technical-architecture-spec.md Section 4.1/4.4 - de-identified
 * derived data is retained, only raw data is cycle-bound).
 *
 * Like rawFileStore.ts, this is a filesystem-backed stand-in for what the
 * architecture spec calls a real on-prem database - the interface (save/
 * getLatest) is narrow enough that a real database-backed implementation
 * could replace it without touching callers.
 */
export class DerivedDataStore {
  constructor(
    private readonly baseDir: string,
    private readonly key: Buffer,
  ) {}

  save(processed: ProcessedUpload): void {
    const dir = join(this.baseDir, processed.teamId, processed.sourceType);
    mkdirSync(dir, { recursive: true });
    encryptToFile(
      join(dir, "latest.enc"),
      Buffer.from(JSON.stringify(processed)),
      this.key,
    );
  }

  getLatest(teamId: string, sourceType: SourceType): ProcessedUpload | undefined {
    const filePath = join(this.baseDir, teamId, sourceType, "latest.enc");
    if (!existsSync(filePath)) return undefined;
    return JSON.parse(decryptFromFile(filePath, this.key).toString()) as ProcessedUpload;
  }
}
