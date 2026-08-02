import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FileAuditLog } from "./auditLog.js";
import { DerivedDataStore } from "./derivedDataStore.js";
import { ingestUpload } from "./ingestUpload.js";
import { EncryptedFileSystemStore } from "./rawFileStore.js";
import { buildXlsx } from "./testFixtures.js";

describe("ingestUpload", () => {
  let dir: string;
  let deps: {
    rawFileStore: EncryptedFileSystemStore;
    derivedDataStore: DerivedDataStore;
    auditLog: FileAuditLog;
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "ingest-upload-"));
    const key = randomBytes(32);
    deps = {
      rawFileStore: new EncryptedFileSystemStore(join(dir, "raw"), key),
      derivedDataStore: new DerivedDataStore(join(dir, "derived"), key),
      auditLog: new FileAuditLog(join(dir, "audit.log")),
    };
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("processes a well-formed upload end to end", async () => {
    const buffer = await buildXlsx(
      ["Department", "Comments"],
      [
        ["Engineering", "John Smith said the hackathon was a great experience for the team."],
        ["Design", "The onboarding process could really use more structure and clarity."],
      ],
    );

    const result = await ingestUpload(deps, "team-a", "annual-survey", buffer);

    expect(result.status).toBe("processed");
    if (result.status !== "processed") throw new Error("expected processed");
    expect(result.cleanRowCount).toBe(2);
    expect(result.quarantinedRowCount).toBe(0);

    const stored = deps.derivedDataStore.getLatest("team-a", "annual-survey");
    expect(stored?.rows[0].values.Comments).not.toContain("John Smith");
    expect(stored?.rows[0].values.Comments).toContain("[NAME]");
  });

  it("rejects a malformed file with a clear error", async () => {
    const result = await ingestUpload(deps, "team-a", "annual-survey", Buffer.from("not a spreadsheet"));

    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("expected rejected");
    expect(result.reason).toMatch(/could not be read/i);
  });

  it("flags an ambiguous column for confirmation instead of guessing, and does not store anything", async () => {
    const buffer = await buildXlsx(
      ["Field3"],
      [
        ["Mostly satisfied with current role and team dynamics overall this year"],
        ["3"],
        ["Neutral"],
        ["Somewhat, but depends on the project honestly speaking"],
      ],
    );

    const result = await ingestUpload(deps, "team-a", "annual-survey", buffer);

    expect(result.status).toBe("needs-confirmation");
    if (result.status !== "needs-confirmation") throw new Error("expected needs-confirmation");
    expect(result.ambiguousColumns).toEqual(["Field3"]);
    expect(deps.derivedDataStore.getLatest("team-a", "annual-survey")).toBeUndefined();
  });

  it("quarantines a row with a low-confidence name candidate instead of treating it as clean", async () => {
    const buffer = await buildXlsx(
      ["Department", "Comments"],
      [["Engineering", "My manager Sarah was really supportive throughout the whole project."]],
    );

    const result = await ingestUpload(deps, "team-a", "annual-survey", buffer);

    expect(result.status).toBe("processed");
    if (result.status !== "processed") throw new Error("expected processed");
    expect(result.quarantinedRowCount).toBe(1);
    expect(result.cleanRowCount).toBe(0);

    const stored = deps.derivedDataStore.getLatest("team-a", "annual-survey");
    expect(stored?.rows[0].status).toBe("quarantined");
    expect(stored?.rows[0].quarantineReasons).toContain("Sarah");
  });

  it("redacts a phone number found in a structured (non-free-text) column", async () => {
    // Phone numbers are short (<=15 chars) -> classified structured by the
    // column classifier, but must still be scrubbed: PII isn't only found
    // in columns the classifier happens to call free-text.
    const buffer = await buildXlsx(
      ["Department", "Contact Phone"],
      [["Engineering", "555-123-4567"]],
    );

    const result = await ingestUpload(deps, "team-a", "annual-survey", buffer);
    expect(result.status).toBe("processed");

    const stored = deps.derivedDataStore.getLatest("team-a", "annual-survey");
    expect(stored?.rows[0].values["Contact Phone"]).not.toContain("555-123-4567");
    expect(stored?.rows[0].values["Contact Phone"]).toContain("[PHONE]");
  });

  it("redacts a full name in an identity-labeled column even though it's classified structured", async () => {
    // "Manager Name" is short-valued -> classified structured, but the header
    // itself signals identity data, so it must still get full name scrubbing.
    const buffer = await buildXlsx(
      ["Department", "Manager Name"],
      [["Engineering", "John Smith"]],
    );

    const result = await ingestUpload(deps, "team-a", "annual-survey", buffer);
    expect(result.status).toBe("processed");

    const stored = deps.derivedDataStore.getLatest("team-a", "annual-survey");
    expect(stored?.rows[0].values["Manager Name"]).not.toContain("John Smith");
    expect(stored?.rows[0].values["Manager Name"]).toContain("[NAME]");
  });

  it("deletes the previous cycle's raw data and logs it when a new upload arrives for the same team and source type", async () => {
    const cycle1 = await buildXlsx(["Department"], [["Engineering"]]);
    const cycle2 = await buildXlsx(["Department"], [["Design"]]);

    const firstResult = await ingestUpload(deps, "team-a", "annual-survey", cycle1);
    if (firstResult.status !== "processed") throw new Error("expected processed");
    const firstFileId = firstResult.fileId;

    await ingestUpload(deps, "team-a", "annual-survey", cycle2);

    expect(() => deps.rawFileStore.read("team-a", "annual-survey", firstFileId)).toThrow();

    const events = deps.auditLog.readAll();
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "raw-data-deleted",
        teamId: "team-a",
        sourceType: "annual-survey",
        deletedFileId: firstFileId,
      }),
    );
  });

  it("does not delete or log anything on the first upload for a team and source type", async () => {
    const buffer = await buildXlsx(["Department"], [["Engineering"]]);
    await ingestUpload(deps, "team-a", "annual-survey", buffer);

    expect(deps.auditLog.readAll()).toEqual([]);
  });
});
