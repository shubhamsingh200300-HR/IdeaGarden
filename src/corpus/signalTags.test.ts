import { describe, expect, it } from "vitest";
import { expandSignalTags } from "./signalTags.js";

describe("expandSignalTags", () => {
  it("returns a plain signal as a single lowercase tag", () => {
    expect(expandSignalTags("Autonomy")).toEqual(["autonomy"]);
  });

  it("splits a slash-compound signal into each of its parts", () => {
    expect(expandSignalTags("recognition/rest")).toEqual(["recognition", "rest"]);
    expect(expandSignalTags("psychological safety/inclusion")).toEqual([
      "psychological safety",
      "inclusion",
    ]);
  });

  it("strips a parenthetical qualifier down to the base signal", () => {
    expect(expandSignalTags("psychological safety (fairness)")).toEqual([
      "psychological safety",
    ]);
  });

  it("does not split the canonical signals that happen to contain a slash", () => {
    expect(expandSignalTags("growth/mastery")).toEqual(["growth/mastery"]);
    expect(expandSignalTags("purpose/impact visibility")).toEqual([
      "purpose/impact visibility",
    ]);
  });

  it("strips a parenthetical qualifier that itself contains a comma", () => {
    expect(
      expandSignalTags("psychological safety (critique focused on concepts, not minutiae)"),
    ).toEqual(["psychological safety"]);
  });
});
