import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DerivedDataStore, type ProcessedUpload } from "./derivedDataStore.js";

describe("DerivedDataStore", () => {
  let dir: string;
  let store: DerivedDataStore;
  const key = randomBytes(32);

  const sample: ProcessedUpload = {
    teamId: "team-a",
    sourceType: "annual-survey",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    columnClassifications: { Department: "structured", Comments: "free-text" },
    rows: [
      { status: "clean", values: { Department: "Engineering", Comments: "[NAME] said onboarding was fine." } },
      { status: "quarantined", values: { Department: "Design", Comments: "Sarah said it was fine." }, quarantineReasons: ["Sarah"] },
    ],
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "derived-data-store-"));
    store = new DerivedDataStore(dir, key);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("saves and retrieves the latest processed upload for a team and source type", () => {
    store.save(sample);
    expect(store.getLatest("team-a", "annual-survey")).toEqual(sample);
  });

  it("returns undefined when nothing has been processed yet", () => {
    expect(store.getLatest("team-a", "pulse-survey")).toBeUndefined();
  });

  it("does not store plaintext on disk", () => {
    store.save(sample);
    const files = readdirSync(join(dir, "team-a", "annual-survey"));
    const contents = readFileSync(join(dir, "team-a", "annual-survey", files[0]));
    expect(contents.includes(Buffer.from("Sarah"))).toBe(false);
  });

  it("overwrites the previous processed data for the same team and source type", () => {
    store.save(sample);
    const updated: ProcessedUpload = { ...sample, uploadedAt: "2026-02-01T00:00:00.000Z" };
    store.save(updated);

    expect(store.getLatest("team-a", "annual-survey")?.uploadedAt).toBe("2026-02-01T00:00:00.000Z");
  });
});
