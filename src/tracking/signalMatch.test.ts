import { describe, expect, it } from "vitest";
import type { FreeTextTheme } from "../analysis/signalAnalysis.js";
import { findMatchingTheme } from "./signalMatch.js";

function theme(overrides: Partial<FreeTextTheme> = {}): FreeTextTheme {
  return { column: "Comments", label: "career progression clarity", count: 5, sentiment: "negative", ...overrides };
}

describe("findMatchingTheme", () => {
  it("matches an exact label", () => {
    const themes = [theme({ label: "career progression clarity" }), theme({ label: "recognition" })];
    expect(findMatchingTheme(themes, "career progression clarity")?.label).toBe("career progression clarity");
  });

  it("matches a close paraphrase, since an idea's signalAddressed is the LLM's own rendering, not guaranteed to be verbatim", () => {
    const themes = [theme({ label: "career progression clarity" }), theme({ label: "recognition" })];
    expect(findMatchingTheme(themes, "clarity around career progression")?.label).toBe("career progression clarity");
  });

  it("returns null when nothing is a close enough match", () => {
    const themes = [theme({ label: "recognition" }), theme({ label: "cross-team visibility" })];
    expect(findMatchingTheme(themes, "career progression clarity")).toBeNull();
  });

  it("returns null for an empty theme list", () => {
    expect(findMatchingTheme([], "career progression clarity")).toBeNull();
  });

  it("picks the single best match when multiple themes are somewhat similar", () => {
    const themes = [
      theme({ label: "career progression clarity", count: 1 }),
      theme({ label: "career growth and progression", count: 2 }),
    ];
    const match = findMatchingTheme(themes, "career progression clarity");
    expect(match?.count).toBe(1);
  });
});
