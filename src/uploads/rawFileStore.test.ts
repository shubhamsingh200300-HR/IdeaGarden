import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EncryptedFileSystemStore } from "./rawFileStore.js";

describe("EncryptedFileSystemStore", () => {
  let dir: string;
  let store: EncryptedFileSystemStore;
  const key = randomBytes(32);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "raw-file-store-"));
    store = new EncryptedFileSystemStore(dir, key);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("stores and retrieves the original bytes", () => {
    const original = Buffer.from("hello, this is a fake xlsx payload");
    const { fileId } = store.save("team-a", "annual-survey", original);

    expect(store.read("team-a", "annual-survey", fileId).equals(original)).toBe(true);
  });

  it("never writes plaintext to disk", () => {
    const original = Buffer.from("super sensitive exit interview content");
    const { fileId } = store.save("team-a", "exit-data", original);

    const rawBytesOnDisk = readFileSync(join(dir, "team-a", "exit-data", `${fileId}.enc`));
    expect(rawBytesOnDisk.includes(original)).toBe(false);
  });

  it("scopes storage by team and source type - no collisions", () => {
    const a = store.save("team-a", "annual-survey", Buffer.from("team a data"));
    const b = store.save("team-b", "annual-survey", Buffer.from("team b data"));

    expect(store.read("team-a", "annual-survey", a.fileId).toString()).toBe("team a data");
    expect(store.read("team-b", "annual-survey", b.fileId).toString()).toBe("team b data");
  });

  it("tracks the current file id for a team and source type, persisted to disk", () => {
    expect(store.getCurrentFileId("team-a", "pulse-survey")).toBeUndefined();

    const { fileId } = store.save("team-a", "pulse-survey", Buffer.from("cycle 1"));
    expect(store.getCurrentFileId("team-a", "pulse-survey")).toBe(fileId);

    // A fresh store instance over the same directory sees the same pointer -
    // this must survive a process restart, not just live in memory.
    const reopened = new EncryptedFileSystemStore(dir, key);
    expect(reopened.getCurrentFileId("team-a", "pulse-survey")).toBe(fileId);

    const { fileId: fileId2 } = store.save("team-a", "pulse-survey", Buffer.from("cycle 2"));
    expect(store.getCurrentFileId("team-a", "pulse-survey")).toBe(fileId2);
  });

  it("deletes a stored file by id", () => {
    const { fileId } = store.save("team-a", "annual-survey", Buffer.from("data"));
    store.delete("team-a", "annual-survey", fileId);

    expect(() => store.read("team-a", "annual-survey", fileId)).toThrow();
  });
});
