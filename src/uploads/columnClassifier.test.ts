import { describe, expect, it } from "vitest";
import { classifyColumn } from "./columnClassifier.js";

describe("classifyColumn", () => {
  it("classifies a column with a free-text header keyword as free-text", () => {
    const result = classifyColumn("Additional Comments", [
      "I really enjoyed the hackathon this year, it gave me a chance to explore ideas.",
      "Management could be more transparent about promotion timelines and criteria.",
    ]);
    expect(result).toBe("free-text");
  });

  it("classifies a short, low-cardinality column as structured", () => {
    const result = classifyColumn("Department", [
      "Engineering",
      "Engineering",
      "Design",
      "Engineering",
      "Design",
    ]);
    expect(result).toBe("structured");
  });

  it("classifies a column of long, mostly-unique free text as free-text by shape alone", () => {
    const result = classifyColumn("Field7", [
      "The onboarding process took much longer than expected and nobody followed up with me.",
      "I would like more visibility into how cross-team projects get prioritized and staffed.",
      "Compensation feels fair but growth opportunities within my level are unclear to me.",
    ]);
    expect(result).toBe("free-text");
  });

  it("flags a column as ambiguous when shape signals conflict", () => {
    const result = classifyColumn("Field3", [
      "Mostly satisfied with current role and team dynamics overall this year",
      "3",
      "Neutral",
      "Somewhat, but depends on the project honestly speaking",
    ]);
    expect(result).toBe("ambiguous");
  });

  it("defaults an empty column to structured", () => {
    expect(classifyColumn("Empty", [])).toBe("structured");
  });

  it("classifies a short categorical column as structured even with very few rows (no false ambiguity from small samples)", () => {
    // Only 2 rows means uniqueness ratio is 1.0 even though this is clearly
    // categorical data - length alone must be enough to decide here.
    expect(classifyColumn("Department", ["Engineering", "Design"])).toBe("structured");
  });

  it("uses uniqueness as a tiebreaker for mid-length columns once there are enough rows to make it meaningful", () => {
    const repeatedMidLength = [
      "Very Satisfied",
      "Somewhat Satisfied",
      "Neutral",
      "Very Satisfied",
      "Somewhat Satisfied",
      "Neutral",
    ];
    expect(classifyColumn("Satisfaction", repeatedMidLength)).toBe("structured");
  });
});
