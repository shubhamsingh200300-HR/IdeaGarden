import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { SourceType } from "./rawFileStore.js";

export interface RawDataDeletedEvent {
  type: "raw-data-deleted";
  teamId: string;
  sourceType: SourceType;
  deletedFileId: string;
  timestamp: string;
}

export type AuditEvent = RawDataDeletedEvent;

/**
 * Append-only audit log, one JSON event per line. True write-once/immutable
 * storage (WORM) is an infrastructure-layer guarantee in a real on-prem
 * deployment; this class only guarantees the application never exposes an
 * update/delete operation on the log itself.
 */
export class FileAuditLog {
  constructor(private readonly logPath: string) {}

  append(event: AuditEvent): void {
    mkdirSync(dirname(this.logPath), { recursive: true });
    appendFileSync(this.logPath, JSON.stringify(event) + "\n");
  }

  readAll(): AuditEvent[] {
    if (!existsSync(this.logPath)) return [];
    return readFileSync(this.logPath, "utf-8")
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as AuditEvent);
  }
}
