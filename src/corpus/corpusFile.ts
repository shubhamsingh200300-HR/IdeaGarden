import { appendFileSync } from "node:fs";
import type { CorpusEntry } from "./parseBenchmarkCorpus.js";

/** Mirrors the exact "### id: ..." block shape parseBenchmarkCorpus.ts expects - the parser only ever splits on that heading, so where in the file this lands doesn't matter, but the field shape must match exactly. */
function renderEntryBlock(entry: CorpusEntry): string {
  const sourceLines = entry.sources.map((source) => `  - ${source}`).join("\n");

  return `\n### id: ${entry.id}
- **company**: ${entry.company}
- **initiative**: ${entry.initiative}
- **signals**: primary: ${entry.primarySignal}; secondary: ${entry.secondarySignals.join(", ")}
- **structure**: ${entry.structure}
- **impact_evidence**: ${entry.impactEvidence}
- **sources**:
${sourceLines}
`;
}

/**
 * Ticket 09: the only way an approved proposal survives a process restart,
 * since loadCorpus.ts re-reads this file from disk at startup and
 * OnPremVectorStore otherwise only holds the addition in memory
 * (vectorStore.addEntry). Appends rather than rewriting the whole file, so
 * a crash mid-write can't corrupt entries that were already there.
 */
export function appendCorpusEntry(filePath: string, entry: CorpusEntry): void {
  appendFileSync(filePath, renderEntryBlock(entry));
}
