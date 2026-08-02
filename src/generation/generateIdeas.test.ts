import { describe, expect, it } from "vitest";
import { OnPremVectorStore } from "../corpus/vectorStore.js";
import type { CorpusEntry } from "../corpus/parseBenchmarkCorpus.js";
import type { GenerationRequest } from "../requests/requestIntakeStore.js";
import type { SignalAnalysisSummary } from "../analysis/signalAnalysis.js";
import { generateIdeas } from "./generateIdeas.js";
import type { GeneratedIdeaDraft, IdeaGenerationInput, IdeaLlmClient } from "./ideaLlmClient.js";

function corpusEntry(overrides: Partial<CorpusEntry>): CorpusEntry {
  return {
    id: "id",
    company: "Co",
    initiative: "Initiative",
    primarySignal: "career progression clarity",
    secondarySignals: [],
    structure: "A standing program.",
    impactEvidence: "",
    sources: [],
    ...overrides,
  };
}

function draft(overrides: Partial<GeneratedIdeaDraft> = {}): GeneratedIdeaDraft {
  return {
    title: "Quarterly Promotion Calibration Council",
    description: "A standing panel reviews promotion packets against transparent criteria.",
    signalAddressed: "career progression clarity",
    structuralFormat: "Quarterly, standing panel",
    isRecurringOrStructural: true,
    ownerRole: "Engineering Director",
    sponsorshipLevel: "org",
    estimatedCostInr: 0,
    estimatedEffort: "4 hours per quarter",
    successMetric: "Improved survey score",
    feasibilityScore: 0.8,
    ...overrides,
  };
}

function request(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    id: "req-1",
    teamId: "team-a",
    hrbpId: "hrbp-1",
    status: "submitted",
    context: "Engineers say promotion criteria feel arbitrary.",
    constraints: { budget: "up to 50,000 INR", time: "half a day max", headcountLogistics: "team of 8" },
    token: null,
    tokenExpiresAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    submittedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

class FakeIdeaLlmClient implements IdeaLlmClient {
  public receivedInputs: IdeaGenerationInput[] = [];
  constructor(private readonly draftsBySignal: Record<string, GeneratedIdeaDraft>) {}

  async generateIdea(input: IdeaGenerationInput): Promise<GeneratedIdeaDraft> {
    this.receivedInputs.push(input);
    const found = this.draftsBySignal[input.signal];
    if (!found) throw new Error(`no fake draft registered for signal ${input.signal}`);
    return found;
  }
}

describe("generateIdeas", () => {
  it("generates ideas only for negative/mixed themes, skipping positive ones", async () => {
    const analysis: SignalAnalysisSummary = {
      teamId: "team-a",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      structuredDimensions: [],
      freeTextThemes: [
        { column: "Comments", label: "career progression clarity", count: 5, sentiment: "negative" },
        { column: "Comments", label: "recognition", count: 5, sentiment: "positive" },
      ],
    };
    const ideaLlmClient = new FakeIdeaLlmClient({
      "career progression clarity": draft(),
      recognition: draft({ signalAddressed: "recognition" }),
    });
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);

    await generateIdeas(request(), analysis, { vectorStore, ideaLlmClient });

    expect(ideaLlmClient.receivedInputs.map((i) => i.signal)).toEqual(["career progression clarity"]);
  });

  it("discards a gate-failing candidate, never returning it at any rank", async () => {
    const analysis: SignalAnalysisSummary = {
      teamId: "team-a",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      structuredDimensions: [],
      freeTextThemes: [
        { column: "Comments", label: "career progression clarity", count: 5, sentiment: "negative" },
        { column: "Comments", label: "belonging", count: 5, sentiment: "negative" },
      ],
    };
    const ideaLlmClient = new FakeIdeaLlmClient({
      "career progression clarity": draft(), // valid
      belonging: draft({
        signalAddressed: "belonging",
        title: "Team Outing",
        description: "A fun team outing to boost belonging.",
      }), // fails the generic-perk gate
    });
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);

    const result = await generateIdeas(request(), analysis, { vectorStore, ideaLlmClient });

    expect(result.ideas.some((i) => i.title === "Team Outing")).toBe(false);
    expect(result.ideas).toHaveLength(1);
  });

  it("returns between 3 and 5 ranked ideas when enough gate-passing candidates exist, ranked best first", async () => {
    const signals = ["s1", "s2", "s3", "s4", "s5", "s6"];
    const analysis: SignalAnalysisSummary = {
      teamId: "team-a",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      structuredDimensions: [],
      freeTextThemes: signals.map((label) => ({ column: "Comments", label, count: 5, sentiment: "negative" as const })),
    };
    const draftsBySignal = Object.fromEntries(
      signals.map((label, i) => [
        label,
        draft({ signalAddressed: label, feasibilityScore: (i + 1) / signals.length }),
      ]),
    );
    const ideaLlmClient = new FakeIdeaLlmClient(draftsBySignal);
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);

    const result = await generateIdeas(request(), analysis, { vectorStore, ideaLlmClient });

    expect(result.ideas.length).toBeGreaterThanOrEqual(3);
    expect(result.ideas.length).toBeLessThanOrEqual(5);
    // Highest feasibilityScore (s6, last in the list) should rank first.
    expect(result.ideas[0].signalAddressed).toBe("s6");
  });

  it("reports how many candidate signals were diagnosed, so a caller can tell a short list apart from something going wrong", async () => {
    const analysis: SignalAnalysisSummary = {
      teamId: "team-a",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      structuredDimensions: [],
      freeTextThemes: [{ column: "Comments", label: "career progression clarity", count: 5, sentiment: "negative" }],
    };
    const ideaLlmClient = new FakeIdeaLlmClient({ "career progression clarity": draft() });
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);

    const result = await generateIdeas(request(), analysis, { vectorStore, ideaLlmClient });

    expect(result.candidateSignalCount).toBe(1);
    expect(result.ideas).toHaveLength(1);
  });

  it("strips internal-only fields (feasibility score, structural flag) from the output", async () => {
    const analysis: SignalAnalysisSummary = {
      teamId: "team-a",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      structuredDimensions: [],
      freeTextThemes: [{ column: "Comments", label: "career progression clarity", count: 5, sentiment: "negative" }],
    };
    const ideaLlmClient = new FakeIdeaLlmClient({ "career progression clarity": draft() });
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);

    const result = await generateIdeas(request(), analysis, { vectorStore, ideaLlmClient });

    expect(result.ideas[0]).not.toHaveProperty("feasibilityScore");
    expect(result.ideas[0]).not.toHaveProperty("isRecurringOrStructural");
    expect(result.ideas[0].title).toBe("Quarterly Promotion Calibration Council");
  });

  it("scrubs PII from the manager's context before it reaches the external LLM", async () => {
    // The manager's context comes through ticket 10's public, unauthenticated
    // form with no scrubbing applied at submission time - this boundary is
    // where it must be anonymized before an external LLM call, matching the
    // "only anonymized data reaches the LLM" rule ticket 03 enforces for survey data.
    const analysis: SignalAnalysisSummary = {
      teamId: "team-a",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      structuredDimensions: [],
      freeTextThemes: [{ column: "Comments", label: "career progression clarity", count: 5, sentiment: "negative" }],
    };
    const ideaLlmClient = new FakeIdeaLlmClient({ "career progression clarity": draft() });
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);
    const contextWithPii = "John Smith emailed hr@example.com about promotion criteria feeling arbitrary.";

    await generateIdeas(request({ context: contextWithPii }), analysis, { vectorStore, ideaLlmClient });

    const sentContext = ideaLlmClient.receivedInputs[0].context;
    expect(sentContext).not.toContain("John Smith");
    expect(sentContext).not.toContain("hr@example.com");
    expect(sentContext).toContain("[NAME]");
    expect(sentContext).toContain("[EMAIL]");
  });

  it("scrubs PII from constraint fields too, not just the context", async () => {
    const analysis: SignalAnalysisSummary = {
      teamId: "team-a",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      structuredDimensions: [],
      freeTextThemes: [{ column: "Comments", label: "career progression clarity", count: 5, sentiment: "negative" }],
    };
    const ideaLlmClient = new FakeIdeaLlmClient({ "career progression clarity": draft() });
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);

    await generateIdeas(
      request({ constraints: { budget: "ask jsmith@example.com for sign-off", time: "", headcountLogistics: "" } }),
      analysis,
      { vectorStore, ideaLlmClient },
    );

    expect(ideaLlmClient.receivedInputs[0].constraints.budget).not.toContain("jsmith@example.com");
    expect(ideaLlmClient.receivedInputs[0].constraints.budget).toContain("[EMAIL]");
  });

  it("redacts even a low-confidence single-word name candidate before the external call, not just high-confidence full names", async () => {
    const analysis: SignalAnalysisSummary = {
      teamId: "team-a",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      structuredDimensions: [],
      freeTextThemes: [{ column: "Comments", label: "career progression clarity", count: 5, sentiment: "negative" }],
    };
    const ideaLlmClient = new FakeIdeaLlmClient({ "career progression clarity": draft() });
    const vectorStore = new OnPremVectorStore([corpusEntry({ id: "a" })]);
    // "Sarah" alone is a low-confidence NER match (ticket 03's quarantine
    // rule) - ticket 03 quarantines the whole row for human review instead
    // of guessing, but there's no such review workflow for manager context
    // here, so the LLM-boundary specifically must redact even low-confidence
    // candidates rather than let them through unredacted.
    const contextWithLowConfidenceName = "My manager Sarah was really supportive throughout the project.";

    await generateIdeas(request({ context: contextWithLowConfidenceName }), analysis, { vectorStore, ideaLlmClient });

    expect(ideaLlmClient.receivedInputs[0].context).not.toContain("Sarah");
  });

  it("retrieves corpus examples scoped to the target signal and passes them to the LLM client", async () => {
    const analysis: SignalAnalysisSummary = {
      teamId: "team-a",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      structuredDimensions: [],
      freeTextThemes: [{ column: "Comments", label: "career progression clarity", count: 5, sentiment: "negative" }],
    };
    const ideaLlmClient = new FakeIdeaLlmClient({ "career progression clarity": draft() });
    const vectorStore = new OnPremVectorStore([
      corpusEntry({ id: "matching", primarySignal: "career progression clarity", company: "Google" }),
      corpusEntry({ id: "unrelated", primarySignal: "recognition", company: "Atlassian" }),
    ]);

    await generateIdeas(request(), analysis, { vectorStore, ideaLlmClient });

    expect(ideaLlmClient.receivedInputs[0].corpusExamples.map((c) => c.company)).toEqual(["Google"]);
  });
});
