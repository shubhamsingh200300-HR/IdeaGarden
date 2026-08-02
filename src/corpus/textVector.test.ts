import { describe, expect, it } from "vitest";
import { cosineSimilarity, TfIdfIndex, tokenize } from "./textVector.js";

describe("tokenize", () => {
  it("lowercases and splits on non-alphanumeric characters", () => {
    expect(tokenize("Hackathon-Days, and Peer Recognition!")).toEqual([
      "hackathon",
      "days",
      "and",
      "peer",
      "recognition",
    ]);
  });
});

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors", () => {
    const v = new Map([["a", 1], ["b", 2]]);
    expect(cosineSimilarity(v, v)).toBeCloseTo(1);
  });

  it("is 0 for vectors with no overlapping terms", () => {
    const a = new Map([["a", 1]]);
    const b = new Map([["b", 1]]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("ranks a partially-overlapping vector between identical and disjoint", () => {
    const query = new Map([["hackathon", 1], ["team", 1]]);
    const close = new Map([["hackathon", 2], ["team", 1], ["annual", 1]]);
    const far = new Map([["mentorship", 1], ["career", 1]]);

    expect(cosineSimilarity(query, close)).toBeGreaterThan(cosineSimilarity(query, far));
  });
});

describe("TfIdfIndex", () => {
  const documents = [
    "annual hackathon for engineers to build side projects",
    "peer recognition program with kudos and awards",
    "mentorship program pairing junior and senior engineers",
  ];
  const index = new TfIdfIndex(documents);

  it("builds one document vector per input document", () => {
    expect(index.documentVectors).toHaveLength(3);
  });

  it("weights a term that appears in every document lower than a term unique to one", () => {
    // "engineers" appears in 2/3 docs, "kudos" appears in 1/3 - kudos should get higher idf weight
    const hackathonVector = index.documentVectors[0];
    const recognitionVector = index.documentVectors[1];
    expect(recognitionVector.get("kudos")!).toBeGreaterThan(hackathonVector.get("engineers")!);
  });

  it("produces a query vector comparable to document vectors via cosine similarity", () => {
    const queryVector = index.vectorFor("hackathon for building side projects");
    const similarities = index.documentVectors.map((docVector) =>
      cosineSimilarity(queryVector, docVector),
    );

    const mostSimilarIndex = similarities.indexOf(Math.max(...similarities));
    expect(mostSimilarIndex).toBe(0);
  });
});
