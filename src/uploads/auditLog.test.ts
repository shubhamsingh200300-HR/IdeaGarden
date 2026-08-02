import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileAuditLog } from "./auditLog.js";

describe("FileAuditLog", () => {
  let dir: string;
  let logPath: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "audit-log-"));
    logPath = join(dir, "audit.log");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("appends events and reads them back in order", () => {
    const log = new FileAuditLog(logPath);

    log.append({
      type: "raw-data-deleted",
      teamId: "team-a",
      sourceType: "annual-survey",
      deletedFileId: "file-1",
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    log.append({
      type: "raw-data-deleted",
      teamId: "team-a",
      sourceType: "pulse-survey",
      deletedFileId: "file-2",
      timestamp: "2026-01-02T00:00:00.000Z",
    });

    expect(log.readAll()).toEqual([
      {
        type: "raw-data-deleted",
        teamId: "team-a",
        sourceType: "annual-survey",
        deletedFileId: "file-1",
        timestamp: "2026-01-01T00:00:00.000Z",
      },
      {
        type: "raw-data-deleted",
        teamId: "team-a",
        sourceType: "pulse-survey",
        deletedFileId: "file-2",
        timestamp: "2026-01-02T00:00:00.000Z",
      },
    ]);
  });

  it("persists across instances (a fresh log over the same file sees prior events)", () => {
    const log = new FileAuditLog(logPath);
    log.append({
      type: "raw-data-deleted",
      teamId: "team-a",
      sourceType: "annual-survey",
      deletedFileId: "file-1",
      timestamp: "2026-01-01T00:00:00.000Z",
    });

    const reopened = new FileAuditLog(logPath);
    expect(reopened.readAll()).toHaveLength(1);
  });

  it("starts empty when no log file exists yet", () => {
    const log = new FileAuditLog(logPath);
    expect(log.readAll()).toEqual([]);
  });
});
