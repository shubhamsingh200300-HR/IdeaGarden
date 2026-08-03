import { describe, expect, it } from "vitest";
import { generateUniqueEntryId } from "./corpusSlug.js";

describe("generateUniqueEntryId", () => {
  it("builds a lowercase, hyphenated slug from company and initiative", () => {
    expect(generateUniqueEntryId("Figma", "Design Critique Fridays", [])).toBe("figma-design-critique-fridays");
  });

  it("strips punctuation rather than leaving stray hyphens", () => {
    expect(generateUniqueEntryId("Shopify", "R&D 'Hack Days'!", [])).toBe("shopify-r-d-hack-days");
  });

  it("appends a numeric suffix when the base slug is already taken", () => {
    const id = generateUniqueEntryId("Figma", "Design Critique Fridays", ["figma-design-critique-fridays"]);
    expect(id).toBe("figma-design-critique-fridays-2");
  });

  it("keeps incrementing the suffix past a second collision", () => {
    const id = generateUniqueEntryId("Figma", "Design Critique Fridays", [
      "figma-design-critique-fridays",
      "figma-design-critique-fridays-2",
    ]);
    expect(id).toBe("figma-design-critique-fridays-3");
  });

  it("is unaffected by unrelated existing ids", () => {
    const id = generateUniqueEntryId("Figma", "Design Critique Fridays", ["netflix-keeper-test", "atlassian-shipit"]);
    expect(id).toBe("figma-design-critique-fridays");
  });
});
