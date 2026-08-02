import type { CorpusEntry } from "./parseBenchmarkCorpus.js";
import { expandSignalTags } from "./signalTags.js";
import { cosineSimilarity, TfIdfIndex } from "./textVector.js";

const DEFAULT_TOP_K = 5;

function entryText(entry: CorpusEntry): string {
  return `${entry.initiative} ${entry.structure} ${entry.impactEvidence}`;
}

function taggedWithSignal(entry: CorpusEntry, signal: string): boolean {
  const target = signal.trim().toLowerCase();
  const tags = [entry.primarySignal, ...entry.secondarySignals].flatMap(expandSignalTags);
  return tags.includes(target);
}

/**
 * On-prem retrieval over the benchmark corpus: embeds every entry at
 * construction time via TfIdfIndex (see textVector.ts for why TF-IDF
 * rather than a neural embedding model), then serves signal-scoped,
 * similarity-ranked queries entirely in-process.
 */
export class OnPremVectorStore {
  private readonly entries: CorpusEntry[];
  private readonly index: TfIdfIndex;

  constructor(entries: CorpusEntry[]) {
    this.entries = entries;
    this.index = new TfIdfIndex(entries.map(entryText));
  }

  retrieveBySignal(signal: string, queryText: string, topK: number = DEFAULT_TOP_K): CorpusEntry[] {
    const queryVector = this.index.vectorFor(queryText);

    const matches = this.entries
      .map((entry, i) => ({ entry, similarity: cosineSimilarity(queryVector, this.index.documentVectors[i]) }))
      .filter(({ entry }) => taggedWithSignal(entry, signal))
      .sort((a, b) => b.similarity - a.similarity);

    return matches.slice(0, topK).map(({ entry }) => entry);
  }
}
