import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CorpusEntry } from "./parseBenchmarkCorpus.js";
import { parseBenchmarkCorpus } from "./parseBenchmarkCorpus.js";
import { appendCorpusEntry } from "./corpusFile.js";

function entry(overrides: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    id: "figma-design-critique-fridays",
    company: "Figma",
    initiative: "Design Critique Fridays",
    primarySignal: "growth/mastery",
    secondarySignals: ["recognition", "cross-team visibility"],
    structure: "A weekly open critique session where any designer can present in-progress work.",
    impactEvidence: "No public quantitative data found.",
    sources: ["https://figma.com/blog/design-critique — first-party description of the ritual"],
    ...overrides,
  };
}

describe("appendCorpusEntry", () => {
  let filePath: string;

  beforeEach(() => {
    const dir = mkdtempSync(join(tmpdir(), "corpus-file-"));
    filePath = join(dir, "benchmark-corpus.md");
    writeFileSync(
      filePath,
      `# Benchmark corpus\n\n## Autonomy & Ownership\n\n### id: netflix-keeper-test\n- **company**: Netflix\n- **initiative**: The Keeper Test\n- **signals**: primary: autonomy; secondary: recognition\n- **structure**: A performance philosophy.\n- **impact_evidence**: Widely cited.\n- **sources**:\n  - https://jobs.netflix.com/culture — primary source\n`,
    );
  });

  afterEach(() => {
    rmSync(filePath, { force: true });
  });

  it("appends a new entry that round-trips back through parseBenchmarkCorpus", () => {
    appendCorpusEntry(filePath, entry());

    const parsed = parseBenchmarkCorpus(readFileSync(filePath, "utf-8"));
    const appended = parsed.find((e) => e.id === "figma-design-critique-fridays");

    expect(appended).toEqual(entry());
  });

  it("leaves the existing entries in the file untouched", () => {
    appendCorpusEntry(filePath, entry());

    const parsed = parseBenchmarkCorpus(readFileSync(filePath, "utf-8"));
    expect(parsed.find((e) => e.id === "netflix-keeper-test")).toBeDefined();
    expect(parsed).toHaveLength(2);
  });

  it("round-trips an entry with multiple sources and no secondary signals", () => {
    const multiSourceEntry = entry({
      secondarySignals: [],
      sources: [
        "https://example.com/one — first source",
        "https://example.com/two — second source",
      ],
    });

    appendCorpusEntry(filePath, multiSourceEntry);

    const parsed = parseBenchmarkCorpus(readFileSync(filePath, "utf-8"));
    expect(parsed.find((e) => e.id === "figma-design-critique-fridays")).toEqual(multiSourceEntry);
  });
});
