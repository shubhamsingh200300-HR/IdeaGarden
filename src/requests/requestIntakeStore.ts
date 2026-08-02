import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { decryptFromFile, encryptToFile } from "../uploads/encryptedFile.js";

export interface RequestConstraints {
  budget: string;
  time: string;
  headcountLogistics: string;
}

export interface GenerationRequest {
  id: string;
  teamId: string;
  hrbpId: string;
  context: string;
  constraints: RequestConstraints;
  submittedAt: string;
}

/**
 * On-prem, per-team-scoped storage for manager context/constraints
 * gathered during request intake (content spec ticket 002; this ticket's
 * "assumption to confirm" is that the HRBP relays this on the manager's
 * behalf, since managers never use the platform directly). Encrypted at
 * rest for consistency with the rest of the pipeline's sensitive data
 * handling (technical-architecture-spec.md Section 4.2).
 */
export class RequestIntakeStore {
  constructor(
    private readonly baseDir: string,
    private readonly key: Buffer,
  ) {}

  save(request: GenerationRequest): void {
    const dir = join(this.baseDir, request.teamId);
    mkdirSync(dir, { recursive: true });
    encryptToFile(join(dir, "latest.enc"), Buffer.from(JSON.stringify(request)), this.key);
  }

  getLatest(teamId: string): GenerationRequest | undefined {
    const filePath = join(this.baseDir, teamId, "latest.enc");
    if (!existsSync(filePath)) return undefined;
    return JSON.parse(decryptFromFile(filePath, this.key).toString()) as GenerationRequest;
  }
}
