import { describe, expect, it } from "vitest";
import { scrubText } from "./piiScrubber.js";

describe("scrubText", () => {
  it("redacts an email address", () => {
    const result = scrubText("Reach out to hr@example.com for details.");
    expect(result.redactedText).not.toContain("hr@example.com");
    expect(result.redactedText).toContain("[EMAIL]");
    expect(result.needsQuarantine).toBe(false);
  });

  it("redacts a NANP-style phone number", () => {
    const result = scrubText("You can call 555-123-4567 anytime.");
    expect(result.redactedText).not.toContain("555-123-4567");
    expect(result.redactedText).toContain("[PHONE]");
    expect(result.needsQuarantine).toBe(false);
  });

  it("redacts a phone number with parens and no separators", () => {
    expect(scrubText("Call (555) 123-4567.").redactedText).toContain("[PHONE]");
    expect(scrubText("Call 5551234567.").redactedText).toContain("[PHONE]");
  });

  it("redacts an Indian-format international phone number", () => {
    const result = scrubText("Reach me at +91 98765 43210 for a follow-up.");
    expect(result.redactedText).not.toContain("98765 43210");
    expect(result.redactedText).toContain("[PHONE]");
  });

  it("redacts an employee id", () => {
    const result = scrubText("Employee ID EMP-48213 requested a transfer.");
    expect(result.redactedText).not.toContain("EMP-48213");
    expect(result.redactedText).toContain("[EMPLOYEE_ID]");
    expect(result.needsQuarantine).toBe(false);
  });

  it("redacts a high-confidence full name (multi-word) without quarantining", () => {
    const result = scrubText("John Smith mentioned in his exit interview that management was unclear.");
    expect(result.redactedText).not.toContain("John Smith");
    expect(result.redactedText).toContain("[NAME]");
    expect(result.needsQuarantine).toBe(false);
  });

  it("quarantines instead of auto-redacting a low-confidence single-word name candidate", () => {
    const result = scrubText("My manager Sarah was really supportive throughout the project.");
    expect(result.needsQuarantine).toBe(true);
    expect(result.flaggedTerms).toContain("Sarah");
  });

  it("does not quarantine text with no PII candidates at all", () => {
    const result = scrubText("I think the team could improve on communication overall.");
    expect(result.needsQuarantine).toBe(false);
    expect(result.flaggedTerms).toEqual([]);
    expect(result.redactedText).toBe("I think the team could improve on communication overall.");
  });
});
