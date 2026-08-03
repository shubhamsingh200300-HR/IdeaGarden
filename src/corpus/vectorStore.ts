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
  private entries: CorpusEntry[];
  private index: TfIdfIndex;

  constructor(entries: CorpusEntry[]) {
    // Defensive copy, matching addEntry below - a caller mutating the array
    // it passed in must not be able to desync this.entries from this.index.
    this.entries = [...entries];
    this.index = new TfIdfIndex(this.entries.map(entryText));
  }

  /**
   * Ticket 09: re-indexing on approval, immediately - not on a periodic
   * schedule. TF-IDF weights depend on the whole document set (textVector.ts),
   * so "adding" one entry means rebuilding the index over all entries, not
   * inserting into an existing one - cheap at this corpus's size. Mutates
   * this instance in place rather than returning a new store, so every
   * existing holder of this same OnPremVectorStore reference (e.g.
   * RunGenerationDeps.vectorStore) sees the addition on its very next call,
   * with no restart and no re-wiring.
   */
  addEntry(entry: CorpusEntry): void {
    this.entries = [...this.entries, entry];
    this.index = new TfIdfIndex(this.entries.map(entryText));
  }

  listEntries(): CorpusEntry[] {
    return [...this.entries];
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
