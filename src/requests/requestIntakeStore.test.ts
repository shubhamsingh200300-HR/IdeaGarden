import { randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RequestIntakeStore, type GenerationRequest } from "./requestIntakeStore.js";

describe("RequestIntakeStore", () => {
  let dir: string;
  let store: RequestIntakeStore;
  const key = randomBytes(32);

  const sample: GenerationRequest = {
    id: "req-1",
    teamId: "team-a",
    hrbpId: "hrbp-1",
    context: "The team shipped a rough launch last quarter and morale is a bit low.",
    constraints: { budget: "up to 50,000 INR", time: "half a day max", headcountLogistics: "team of 8, hybrid" },
    submittedAt: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "request-intake-store-"));
    store = new RequestIntakeStore(dir, key);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("saves a request and retrieves the latest one for its team", () => {
    store.save(sample);
    expect(store.getLatest("team-a")).toEqual(sample);
  });

  it("returns undefined when no request has been submitted for a team yet", () => {
    expect(store.getLatest("team-b")).toBeUndefined();
  });

  it("scopes requests by team - one team's latest never leaks into another's", () => {
    const forTeamB: GenerationRequest = { ...sample, id: "req-2", teamId: "team-b" };
    store.save(sample);
    store.save(forTeamB);

    expect(store.getLatest("team-a")?.id).toBe("req-1");
    expect(store.getLatest("team-b")?.id).toBe("req-2");
  });

  it("keeps the most recently saved request as latest when a team submits again", () => {
    store.save(sample);
    const resubmitted: GenerationRequest = {
      ...sample,
      id: "req-3",
      context: "Updated context after talking to the manager again.",
    };
    store.save(resubmitted);

    expect(store.getLatest("team-a")?.id).toBe("req-3");
  });

  it("does not store plaintext on disk", () => {
    store.save(sample);
    const files = readdirSync(join(dir, "team-a"));
    const contents = readFileSync(join(dir, "team-a", files[0]));
    expect(contents.includes(Buffer.from(sample.context))).toBe(false);
  });
});
