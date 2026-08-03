import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PublicIdeaCard } from "../generation/generateIdeas.js";
import { AdoptedIdeaStore } from "./adoptedIdeaStore.js";

function ideaCard(overrides: Partial<PublicIdeaCard> = {}): PublicIdeaCard {
  return {
    title: "Quarterly Promotion Calibration Council",
    description: "A standing panel reviews promotion packets against transparent criteria.",
    signalAddressed: "career progression clarity",
    structuralFormat: "Quarterly, standing panel",
    ownerRole: "Engineering Director",
    sponsorshipLevel: "org",
    estimatedCostInr: 15000,
    estimatedEffort: "4 hours per quarter",
    successMetric: "Improved survey score",
    ...overrides,
  };
}

describe("AdoptedIdeaStore", () => {
  let dir: string;
  let key: Buffer;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "adopted-idea-store-"));
    key = randomBytes(32);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns an empty list for a team with no adoptions", () => {
    const store = new AdoptedIdeaStore(dir, key);
    expect(store.list("team-a")).toEqual([]);
  });

  it("records an adoption with a baseline snapshot and no outcome yet", () => {
    const store = new AdoptedIdeaStore(dir, key);

    const record = store.adopt("team-a", ideaCard(), { count: 5, sentiment: "negative" });

    expect(record.teamId).toBe("team-a");
    expect(record.idea.title).toBe("Quarterly Promotion Calibration Council");
    expect(record.baseline).toEqual({ count: 5, sentiment: "negative" });
    expect(record.outcome).toBeNull();
    expect(record.id).toBeTruthy();
  });

  it("allows adopting with a null baseline (no survey data available yet)", () => {
    const store = new AdoptedIdeaStore(dir, key);
    const record = store.adopt("team-a", ideaCard(), null);
    expect(record.baseline).toBeNull();
  });

  it("persists across store instances (file-backed, like the other stores)", () => {
    const store = new AdoptedIdeaStore(dir, key);
    store.adopt("team-a", ideaCard(), { count: 5, sentiment: "negative" });

    const reopened = new AdoptedIdeaStore(dir, key);
    expect(reopened.list("team-a")).toHaveLength(1);
  });

  it("keeps adoptions scoped per team", () => {
    const store = new AdoptedIdeaStore(dir, key);
    store.adopt("team-a", ideaCard(), { count: 5, sentiment: "negative" });

    expect(store.list("team-b")).toEqual([]);
  });

  it("appends rather than overwriting on a second adoption for the same team", () => {
    const store = new AdoptedIdeaStore(dir, key);
    store.adopt("team-a", ideaCard({ title: "First idea" }), { count: 5, sentiment: "negative" });
    store.adopt("team-a", ideaCard({ title: "Second idea" }), { count: 3, sentiment: "mixed" });

    const all = store.list("team-a");
    expect(all).toHaveLength(2);
    expect(all.map((r) => r.idea.title)).toEqual(["First idea", "Second idea"]);
  });

  it("only returns adoptions still awaiting an outcome from pendingOutcomes", () => {
    const store = new AdoptedIdeaStore(dir, key);
    const first = store.adopt("team-a", ideaCard({ title: "First idea" }), { count: 5, sentiment: "negative" });
    store.adopt("team-a", ideaCard({ title: "Second idea" }), { count: 3, sentiment: "mixed" });

    store.recordOutcome("team-a", first.id, { count: 1, sentiment: "positive" }, true);

    const pending = store.pendingOutcomes("team-a");
    expect(pending).toHaveLength(1);
    expect(pending[0].idea.title).toBe("Second idea");
  });

  it("records an outcome onto the matching adoption without disturbing others", () => {
    const store = new AdoptedIdeaStore(dir, key);
    const first = store.adopt("team-a", ideaCard({ title: "First idea" }), { count: 5, sentiment: "negative" });
    const second = store.adopt("team-a", ideaCard({ title: "Second idea" }), { count: 3, sentiment: "mixed" });

    store.recordOutcome("team-a", first.id, { count: 1, sentiment: "positive" }, true);

    const all = store.list("team-a");
    const updatedFirst = all.find((r) => r.id === first.id)!;
    const untouchedSecond = all.find((r) => r.id === second.id)!;

    expect(updatedFirst.outcome).toEqual({
      comparedAt: expect.any(String),
      after: { count: 1, sentiment: "positive" },
      improved: true,
    });
    expect(untouchedSecond.outcome).toBeNull();
  });

  it("supports a null 'after' snapshot, meaning the signal no longer surfaced at all", () => {
    const store = new AdoptedIdeaStore(dir, key);
    const record = store.adopt("team-a", ideaCard(), { count: 5, sentiment: "negative" });

    store.recordOutcome("team-a", record.id, null, true);

    expect(store.list("team-a")[0].outcome?.after).toBeNull();
  });

  it("does nothing when recordOutcome is called with an id that doesn't exist", () => {
    const store = new AdoptedIdeaStore(dir, key);
    store.adopt("team-a", ideaCard(), { count: 5, sentiment: "negative" });

    expect(() => store.recordOutcome("team-a", "nonexistent-id", null, false)).not.toThrow();
    expect(store.list("team-a")[0].outcome).toBeNull();
  });
});
