import { describe, expect, it } from "vitest";
import type { ProcessedUpload } from "../uploads/derivedDataStore.js";
import type { LlmClient, Theme } from "./llmClient.js";
import { analyzeSignals } from "./signalAnalysis.js";

class FakeLlmClient implements LlmClient {
  public receivedTexts: string[][] = [];
  constructor(private readonly themesToReturn: Theme[]) {}

  async extractThemes(texts: string[]): Promise<Theme[]> {
    this.receivedTexts.push(texts);
    return this.themesToReturn;
  }
}

function buildProcessedUpload(overrides: Partial<ProcessedUpload> = {}): ProcessedUpload {
  return {
    teamId: "team-a",
    sourceType: "annual-survey",
    uploadedAt: "2026-01-01T00:00:00.000Z",
    columnClassifications: { Department: "structured", Comments: "free-text" },
    rows: [],
    ...overrides,
  };
}

describe("analyzeSignals", () => {
  it("summarizes structured columns using only clean rows", async () => {
    const processed = buildProcessedUpload({
      rows: [
        { status: "clean", values: { Department: "Engineering", Comments: "Fine." } },
        { status: "clean", values: { Department: "Engineering", Comments: "Good." } },
        { status: "clean", values: { Department: "Engineering", Comments: "OK." } },
        { status: "clean", values: { Department: "Engineering", Comments: "Great." } },
        { status: "clean", values: { Department: "Engineering", Comments: "Nice." } },
        {
          status: "quarantined",
          values: { Department: "Design", Comments: "[unreviewed]" },
          quarantineReasons: ["Sam"],
        },
      ],
    });
    const llmClient = new FakeLlmClient([]);

    const summary = await analyzeSignals(processed, llmClient);

    const departmentDimension = summary.structuredDimensions.find((d) => d.column === "Department");
    expect(departmentDimension?.breakdown).toEqual([{ value: "Engineering", count: 5 }]);
    // The quarantined row's "Design" value must not appear at all - not even rolled up.
    expect(JSON.stringify(departmentDimension)).not.toContain("Design");
  });

  it("sends only clean rows' free text to the LLM, excluding quarantined rows", async () => {
    const processed = buildProcessedUpload({
      rows: [
        { status: "clean", values: { Department: "Engineering", Comments: "Career growth feels unclear." } },
        {
          status: "quarantined",
          values: { Department: "Engineering", Comments: "Sarah said the same thing." },
          quarantineReasons: ["Sarah"],
        },
      ],
    });
    const llmClient = new FakeLlmClient([
      { label: "career progression clarity", count: 1, sentiment: "negative" },
    ]);

    await analyzeSignals(processed, llmClient);

    expect(llmClient.receivedTexts).toEqual([["Career growth feels unclear."]]);
  });

  it("includes free-text themes in the summary, tagged with their source column", async () => {
    const processed = buildProcessedUpload({
      rows: [{ status: "clean", values: { Department: "Engineering", Comments: "Some comment." } }],
    });
    const llmClient = new FakeLlmClient([
      { label: "career progression clarity", count: 3, sentiment: "negative" },
    ]);

    const summary = await analyzeSignals(processed, llmClient);

    expect(summary.freeTextThemes).toEqual([
      { column: "Comments", label: "career progression clarity", count: 3, sentiment: "negative" },
    ]);
  });

  it("does not call the LLM at all when there are no clean rows with free text", async () => {
    const processed = buildProcessedUpload({
      rows: [
        {
          status: "quarantined",
          values: { Department: "Engineering", Comments: "Sarah's comment." },
          quarantineReasons: ["Sarah"],
        },
      ],
    });
    const llmClient = new FakeLlmClient([]);

    const summary = await analyzeSignals(processed, llmClient);

    expect(llmClient.receivedTexts).toEqual([]);
    expect(summary.freeTextThemes).toEqual([]);
  });

  it("ties the summary to the team and records when it ran", async () => {
    const processed = buildProcessedUpload({ teamId: "team-b", rows: [] });
    const llmClient = new FakeLlmClient([]);

    const summary = await analyzeSignals(processed, llmClient);

    expect(summary.teamId).toBe("team-b");
    expect(summary.analyzedAt).toBeTruthy();
  });
});
