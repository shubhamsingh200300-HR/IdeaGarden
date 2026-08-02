import { describe, expect, it } from "vitest";
import { passesGate } from "./gate.js";
import type { GeneratedIdeaDraft } from "./ideaLlmClient.js";

function draft(overrides: Partial<GeneratedIdeaDraft> = {}): GeneratedIdeaDraft {
  return {
    title: "Quarterly Promotion Calibration Council",
    description: "A standing cross-team panel reviews promotion packets against transparent criteria.",
    signalAddressed: "career progression clarity",
    structuralFormat: "Quarterly, standing panel of senior engineers",
    isRecurringOrStructural: true,
    ownerRole: "Engineering Director",
    sponsorshipLevel: "org",
    estimatedCostInr: 0,
    estimatedEffort: "4 hours per quarter per panel member",
    successMetric: "Increase in career-progression-clarity survey score",
    feasibilityScore: 0.8,
    ...overrides,
  };
}

describe("passesGate", () => {
  it("passes a well-formed, specific, structural, owned idea", () => {
    expect(passesGate(draft())).toBe(true);
  });

  it("fails an idea with no signal addressed", () => {
    expect(passesGate(draft({ signalAddressed: "" }))).toBe(false);
    expect(passesGate(draft({ signalAddressed: "   " }))).toBe(false);
  });

  it("fails a one-off, non-structural idea", () => {
    expect(passesGate(draft({ isRecurringOrStructural: false }))).toBe(false);
  });

  it("fails an idea with no defined owner", () => {
    expect(passesGate(draft({ ownerRole: null }))).toBe(false);
    expect(passesGate(draft({ ownerRole: "   " }))).toBe(false);
  });

  it("fails an idea with no sponsorship level", () => {
    expect(passesGate(draft({ sponsorshipLevel: null }))).toBe(false);
  });

  it("fails a generic perk dressed up with a real signal and owner", () => {
    expect(
      passesGate(
        draft({
          title: "Monthly Team Outing",
          description: "Take the team out for a fun outing every month to boost morale.",
        }),
      ),
    ).toBe(false);

    expect(
      passesGate(
        draft({
          title: "Birthday Cake Fridays",
          description: "Celebrate everyone's birthday with cake on the last Friday of the month.",
        }),
      ),
    ).toBe(false);

    expect(
      passesGate(
        draft({
          title: "Company Swag Drop",
          description: "Distribute branded swag to boost team spirit.",
        }),
      ),
    ).toBe(false);

    expect(
      passesGate(
        draft({
          title: "Free Snack Fridays",
          description: "Stock the kitchen with free snacks every Friday.",
        }),
      ),
    ).toBe(false);
  });
});
