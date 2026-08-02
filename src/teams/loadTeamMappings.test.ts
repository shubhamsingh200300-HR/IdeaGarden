import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadTeamMappings } from "./loadTeamMappings.js";

describe("loadTeamMappings", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "team-mappings-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("loads mappings from a JSON file", () => {
    const filePath = join(dir, "mappings.json");
    writeFileSync(
      filePath,
      JSON.stringify([
        { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
      ]),
    );

    expect(loadTeamMappings(filePath)).toEqual([
      { teamId: "team-a", teamName: "Backend Platform", hrbpId: "hrbp-1" },
    ]);
  });

  it("returns an empty list when no path is given", () => {
    expect(loadTeamMappings(undefined)).toEqual([]);
  });

  it("throws a clear error when the file contents aren't a valid mapping array", () => {
    const filePath = join(dir, "bad.json");
    writeFileSync(filePath, JSON.stringify({ not: "an array" }));

    expect(() => loadTeamMappings(filePath)).toThrow(/must be a JSON array/i);
  });
});
