import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { decryptFromFile, encryptToFile } from "../uploads/encryptedFile.js";
import type { GenerationResult } from "./generateIdeas.js";

/**
 * On-prem, per-team-scoped storage for the latest generated batch (ticket
 * 07: viewing ideas shouldn't re-run generation - and its external LLM
 * calls - on every page visit; only an explicit regenerate action does).
 * Overwrites on each generation, mirroring RequestIntakeStore/
 * DerivedDataStore's "latest" pattern - no history is kept.
 */
export class GeneratedIdeasStore {
  constructor(
    private readonly baseDir: string,
    private readonly key: Buffer,
  ) {}

  save(teamId: string, result: GenerationResult): void {
    const dir = join(this.baseDir, teamId);
    mkdirSync(dir, { recursive: true });
    encryptToFile(join(dir, "latest.enc"), Buffer.from(JSON.stringify(result)), this.key);
  }

  getLatest(teamId: string): GenerationResult | undefined {
    const filePath = join(this.baseDir, teamId, "latest.enc");
    if (!existsSync(filePath)) return undefined;
    return JSON.parse(decryptFromFile(filePath, this.key).toString()) as GenerationResult;
  }
}
