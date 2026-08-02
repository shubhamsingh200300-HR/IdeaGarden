import { describe, expect, it } from "vitest";
import { summarizeStructuredColumn } from "./structuredBreakdown.js";

describe("summarizeStructuredColumn", () => {
  it("shows a group at or above the size-5 threshold as-is", () => {
    const values = ["Engineering", "Engineering", "Engineering", "Engineering", "Engineering"];
    const result = summarizeStructuredColumn("Department", values);

    expect(result).toEqual({
      column: "Department",
      breakdown: [{ value: "Engineering", count: 5 }],
    });
  });

  it("rolls up a group smaller than 5 rather than showing it as-is or suppressing it entirely", () => {
    const values = ["Engineering", "Engineering", "Engineering", "Engineering", "Engineering", "Design", "Design"];
    const result = summarizeStructuredColumn("Department", values);

    expect(result.breakdown).toContainEqual({ value: "Engineering", count: 5 });
    expect(result.breakdown).not.toContainEqual({ value: "Design", count: 2 });
    expect(result.breakdown).toContainEqual({ value: "Other (combined for privacy)", count: 2 });
  });

  it("merges multiple small groups into a single combined rollup bucket, not one per small group", () => {
    const values = ["A", "A", "A", "A", "A", "B", "B", "C"]; // A: 5 (kept), B: 2, C: 1 (both rolled up together)
    const result = summarizeStructuredColumn("Field", values);

    expect(result.breakdown).toEqual([
      { value: "A", count: 5 },
      { value: "Other (combined for privacy)", count: 3 },
    ]);
  });

  it("does not roll up when every group already meets the threshold", () => {
    const values = ["A", "A", "A", "A", "A", "B", "B", "B", "B", "B"];
    const result = summarizeStructuredColumn("Field", values);

    expect(result.breakdown).toEqual([
      { value: "A", count: 5 },
      { value: "B", count: 5 },
    ]);
  });

  it("handles an empty column", () => {
    expect(summarizeStructuredColumn("Empty", [])).toEqual({ column: "Empty", breakdown: [] });
  });
});
