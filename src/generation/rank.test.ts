import { describe, expect, it } from "vitest";
import { scoreIdea } from "./rank.js";
import type { GeneratedIdeaDraft } from "./ideaLlmClient.js";

function draft(overrides: Partial<GeneratedIdeaDraft> = {}): GeneratedIdeaDraft {
  return {
    title: "Quarterly Promotion Calibration Council",
    description: "A standing cross-team panel reviews promotion packets against transparent criteria.",
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

const baseCtx = {
  targetSignal: "career progression clarity",
  corpusExamplesUsed: [
    {
      company: "Google",
      initiative: "Promotion packet & calibration committee process",
      structure: "Structured written packets reviewed by a calibration committee against transparent criteria.",
    },
  ],
  corpusExamplesRequested: 3,
};

describe("scoreIdea", () => {
  it("scores a higher-feasibility idea above an otherwise-identical lower-feasibility one addressing the same signal", () => {
    const feasible = draft({ feasibilityScore: 0.9 });
    const infeasible = draft({ feasibilityScore: 0.1 });

    expect(scoreIdea(feasible, baseCtx)).toBeGreaterThan(scoreIdea(infeasible, baseCtx));
  });

  it("clamps an out-of-range self-reported feasibility score rather than letting it dominate or invert ranking", () => {
    const withinRange = draft({ feasibilityScore: 1 });
    const overReported = draft({ feasibilityScore: 5 }); // a misbehaving LLM response
    const underReported = draft({ feasibilityScore: -3 });

    expect(scoreIdea(overReported, baseCtx)).toBe(scoreIdea(withinRange, baseCtx));
    expect(scoreIdea(underReported, baseCtx)).toBeLessThan(scoreIdea(withinRange, baseCtx));
  });

  it("scores an idea matching the exact targeted signal above one that drifted to a completely different signal", () => {
    const onTarget = draft({ signalAddressed: "career progression clarity" });
    const driftedOffTarget = draft({ signalAddressed: "recognition" });

    expect(scoreIdea(onTarget, baseCtx)).toBeGreaterThan(scoreIdea(driftedOffTarget, baseCtx));
  });

  it("gives graduated (not binary) credit for a close paraphrase of the target signal, above a totally unrelated one", () => {
    const paraphrase = draft({ signalAddressed: "career progression clarity and growth" });
    const unrelated = draft({ signalAddressed: "office snacks" });

    const paraphraseScore = scoreIdea(paraphrase, baseCtx);
    const exactScore = scoreIdea(draft({ signalAddressed: "career progression clarity" }), baseCtx);
    const unrelatedScore = scoreIdea(unrelated, baseCtx);

    expect(paraphraseScore).toBeLessThan(exactScore);
    expect(paraphraseScore).toBeGreaterThan(unrelatedScore);
  });

  it("scores higher structural ambition (exec sponsorship) above lower (team-level)", () => {
    const execSponsored = draft({ sponsorshipLevel: "exec" });
    const teamSponsored = draft({ sponsorshipLevel: "team" });

    expect(scoreIdea(execSponsored, baseCtx)).toBeGreaterThan(scoreIdea(teamSponsored, baseCtx));
  });

  it("scores an idea whose text actually overlaps with the retrieved precedent above one that ignores it entirely", () => {
    const grounded = draft({
      description:
        "A standing calibration committee reviews structured written promotion packets against transparent criteria, modeled on proven practice.",
    });
    const ungrounded = draft({
      title: "Something Else Entirely",
      description: "A completely unrelated idea about office plants and desk arrangements.",
    });

    expect(scoreIdea(grounded, baseCtx)).toBeGreaterThan(scoreIdea(ungrounded, baseCtx));
  });

  it("scores zero precedent grounding when no corpus examples were available at all", () => {
    const ctxWithNoExamples = { ...baseCtx, corpusExamplesUsed: [] };
    const withExamples = scoreIdea(draft(), baseCtx);
    const withoutExamples = scoreIdea(draft(), ctxWithNoExamples);

    expect(withoutExamples).toBeLessThan(withExamples);
  });

  it("weighs fit and feasibility more heavily than structural ambition and precedent grounding", () => {
    const fitAndFeasible = draft({ signalAddressed: "career progression clarity", feasibilityScore: 1, sponsorshipLevel: "team" });
    const ambitiousButMistargeted = draft({
      signalAddressed: "office snacks",
      feasibilityScore: 0,
      sponsorshipLevel: "exec",
      description:
        "A standing calibration committee reviews structured written promotion packets against transparent criteria.",
    });

    const ctxNoGrounding = { ...baseCtx, corpusExamplesUsed: [] };

    expect(scoreIdea(fitAndFeasible, ctxNoGrounding)).toBeGreaterThan(
      scoreIdea(ambitiousButMistargeted, baseCtx),
    );
  });
});
