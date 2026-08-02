export type TermVector = Map<string, number>;

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function magnitude(vector: TermVector): number {
  let sumOfSquares = 0;
  for (const weight of vector.values()) sumOfSquares += weight * weight;
  return Math.sqrt(sumOfSquares);
}

export function cosineSimilarity(a: TermVector, b: TermVector): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;

  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  let dotProduct = 0;
  for (const [term, weight] of smaller) {
    const otherWeight = larger.get(term);
    if (otherWeight !== undefined) dotProduct += weight * otherWeight;
  }

  return dotProduct / (magA * magB);
}

/**
 * A local, in-process TF-IDF index — a lightweight, fully on-prem stand-in
 * for embedding text into a vector space. This is a deliberate scoping
 * simplification: a real on-prem deployment would more likely run an
 * actual local embedding model (e.g. a sentence-transformer served via
 * ONNX), but that requires model-hosting infrastructure beyond what a
 * single tracer-bullet ticket should stand up. The retrieval interface
 * (OnPremVectorStore) is written so a real embedding model could replace
 * this index without changing how callers use it.
 */
export class TfIdfIndex {
  readonly documentVectors: TermVector[];
  private readonly idf: Map<string, number>;

  constructor(documents: string[]) {
    const tokenizedDocs = documents.map(tokenize);
    this.idf = TfIdfIndex.computeIdf(tokenizedDocs);
    this.documentVectors = tokenizedDocs.map((tokens) => this.weightedVector(tokens));
  }

  vectorFor(text: string): TermVector {
    return this.weightedVector(tokenize(text));
  }

  private weightedVector(tokens: string[]): TermVector {
    const termFrequency = new Map<string, number>();
    for (const token of tokens) {
      termFrequency.set(token, (termFrequency.get(token) ?? 0) + 1);
    }

    const vector: TermVector = new Map();
    for (const [term, tf] of termFrequency) {
      const idf = this.idf.get(term) ?? 0;
      if (idf > 0) vector.set(term, tf * idf);
    }
    return vector;
  }

  private static computeIdf(tokenizedDocs: string[][]): Map<string, number> {
    const documentFrequency = new Map<string, number>();
    for (const tokens of tokenizedDocs) {
      for (const term of new Set(tokens)) {
        documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
      }
    }

    const totalDocs = tokenizedDocs.length;
    const idf = new Map<string, number>();
    for (const [term, docFreq] of documentFrequency) {
      idf.set(term, Math.log((totalDocs + 1) / (docFreq + 1)) + 1);
    }
    return idf;
  }
}
