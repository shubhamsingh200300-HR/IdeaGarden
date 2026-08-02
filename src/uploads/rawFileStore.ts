import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decryptFromFile, encryptToFile } from "./encryptedFile.js";

export const SOURCE_TYPES = ["annual-survey", "pulse-survey", "exit-data"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

/**
 * On-prem, per-team-scoped raw file storage with encryption at rest
 * (AES-256-GCM). This is a filesystem-backed stand-in for a real on-prem
 * object store (technical-architecture-spec.md Section 4.1) - deliberately
 * stateless (every read derives its path from (teamId, sourceType, fileId)
 * and the "current file" pointer is a file on disk, not in-memory) so it
 * survives a process restart without needing a database. "Encryption in
 * transit" is a deployment-layer (TLS/reverse proxy) concern, not
 * something this class can provide or be tested for.
 */
export class EncryptedFileSystemStore {
  constructor(
    private readonly baseDir: string,
    private readonly key: Buffer,
  ) {}

  save(teamId: string, sourceType: SourceType, plaintext: Buffer): { fileId: string } {
    const fileId = randomUUID();
    const dir = this.dirFor(teamId, sourceType);
    mkdirSync(dir, { recursive: true });

    encryptToFile(this.filePathFor(teamId, sourceType, fileId), plaintext, this.key);
    writeFileSync(this.currentPointerPath(teamId, sourceType), JSON.stringify({ fileId }));

    return { fileId };
  }

  read(teamId: string, sourceType: SourceType, fileId: string): Buffer {
    const filePath = this.filePathFor(teamId, sourceType, fileId);
    if (!existsSync(filePath)) {
      throw new Error(`No stored file for ${teamId}/${sourceType}/${fileId}`);
    }
    return decryptFromFile(filePath, this.key);
  }

  delete(teamId: string, sourceType: SourceType, fileId: string): void {
    const filePath = this.filePathFor(teamId, sourceType, fileId);
    if (existsSync(filePath)) unlinkSync(filePath);
  }

  getCurrentFileId(teamId: string, sourceType: SourceType): string | undefined {
    const pointerPath = this.currentPointerPath(teamId, sourceType);
    if (!existsSync(pointerPath)) return undefined;
    return (JSON.parse(readFileSync(pointerPath, "utf-8")) as { fileId: string }).fileId;
  }

  private dirFor(teamId: string, sourceType: SourceType): string {
    return join(this.baseDir, teamId, sourceType);
  }

  private filePathFor(teamId: string, sourceType: SourceType, fileId: string): string {
    return join(this.dirFor(teamId, sourceType), `${fileId}.enc`);
  }

  private currentPointerPath(teamId: string, sourceType: SourceType): string {
    return join(this.dirFor(teamId, sourceType), "current.json");
  }
}
