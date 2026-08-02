import { describe, expect, it } from "vitest";
import { parseBenchmarkCorpus } from "./parseBenchmarkCorpus.js";

const sample = `# Benchmark corpus

## Autonomy & Ownership

### id: netflix-freedom-responsibility-keeper-test
- **company**: Netflix
- **initiative**: Freedom & Responsibility Culture Memo / The Keeper Test
- **signals**: primary: autonomy; secondary: psychological safety, career progression clarity, recognition
- **structure**: Netflix's public Culture Memo sets out "freedom and responsibility" as the operating model.
- **impact_evidence**: Viewed more than 5 million times publicly.
- **sources**:
  - https://jobs.netflix.com/culture — primary culture memo
  - https://hbr.org/2014/01/how-netflix-reinvented-hr — HBR article

### id: atlassian-shipit-days
- **company**: Atlassian
- **initiative**: ShipIt Days (company-wide hackathon)
- **signals**: primary: autonomy; secondary: recognition, cross-team visibility, growth/mastery
- **structure**: A 24-hour innovation sprint run twice a year.
- **impact_evidence**: Drew over 2,000 participants.
- **sources**:
  - https://www.atlassian.com/blog/development/from-ideas-to-impact-the-story-of-shipit — history

---

## Growth & Mastery

### id: netflix-hack-day
- **company**: Netflix
- **initiative**: Netflix Hack Day
- **signals**: primary: growth/mastery; secondary: cross-team visibility, autonomy, recognition
- **structure**: A recurring 24-hour internal hackathon.
- **impact_evidence**: Over 150 people participated.
- **sources**:
  - https://netflixtechblog.com/netflix-hack-day-d88c7d505461 — format

---

## Entries deliberately excluded or noted, not written up

- **Some excluded thing** — could not be verified.
`;

describe("parseBenchmarkCorpus", () => {
  const entries = parseBenchmarkCorpus(sample);

  it("parses every '### id:' entry and none of the excluded-section prose", () => {
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.id)).toEqual([
      "netflix-freedom-responsibility-keeper-test",
      "atlassian-shipit-days",
      "netflix-hack-day",
    ]);
  });

  it("extracts company, initiative, structure, and impact evidence", () => {
    const entry = entries[0];
    expect(entry.company).toBe("Netflix");
    expect(entry.initiative).toBe("Freedom & Responsibility Culture Memo / The Keeper Test");
    expect(entry.structure).toContain("freedom and responsibility");
    expect(entry.impactEvidence).toContain("5 million times");
  });

  it("splits the signals line into a primary signal and a secondary-signals list", () => {
    const entry = entries[0];
    expect(entry.primarySignal).toBe("autonomy");
    expect(entry.secondarySignals).toEqual([
      "psychological safety",
      "career progression clarity",
      "recognition",
    ]);
  });

  it("keeps a secondary signal with an internal comma inside parentheses intact", () => {
    const withParenComma = `${sample}

### id: airbnb-dls
- **company**: Airbnb
- **initiative**: Design Language System (DLS)
- **signals**: primary: cross-team visibility; secondary: autonomy, psychological safety (critique focused on concepts, not minutiae)
- **structure**: A shared design system.
- **impact_evidence**: Widely adopted.
- **sources**:
  - https://example.com — source
`;
    const parsed = parseBenchmarkCorpus(withParenComma);
    const dls = parsed.find((e) => e.id === "airbnb-dls")!;

    expect(dls.secondarySignals).toEqual([
      "autonomy",
      "psychological safety (critique focused on concepts, not minutiae)",
    ]);
  });

  it("extracts source URLs", () => {
    const entry = entries[0];
    expect(entry.sources).toEqual([
      "https://jobs.netflix.com/culture — primary culture memo",
      "https://hbr.org/2014/01/how-netflix-reinvented-hr — HBR article",
    ]);
  });
});
