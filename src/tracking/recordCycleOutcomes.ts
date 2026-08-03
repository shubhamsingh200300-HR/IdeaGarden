import type { LlmClient } from "../analysis/llmClient.js";
import { analyzeSignals } from "../analysis/signalAnalysis.js";
import type { ProcessedUpload } from "../uploads/derivedDataStore.js";
import { AdoptedIdeaStore } from "./adoptedIdeaStore.js";
import { findMatchingTheme } from "./signalMatch.js";

export interface RecordCycleOutcomesDeps {
  adoptedIdeaStore: AdoptedIdeaStore;
  themeLlmClient: LlmClient;
}

/**
 * Runs automatically after a new annual-survey cycle is ingested (ticket
 * 03) for a team with at least one adoption still awaiting comparison
 * (ticket 08's second and third checkboxes: no further HRBP effort
 * required, and the result is surfaced once it exists). Only reads the
 * already-anonymized, already-ingested `processed` upload passed in - same
 * boundary every other consumer of signalAnalysis.ts respects.
 *
 * A signal that no longer surfaces at all in the new cycle is the best
 * possible outcome (fully resolved), not a missing measurement, so it
 * counts as improved.
 */
export async function recordCycleOutcomes(
  deps: RecordCycleOutcomesDeps,
  teamId: string,
  processed: ProcessedUpload,
): Promise<void> {
  const pending = deps.adoptedIdeaStore.pendingOutcomes(teamId);
  if (pending.length === 0) return;

  const analysis = await analyzeSignals(processed, deps.themeLlmClient);

  for (const record of pending) {
    const matched = findMatchingTheme(analysis.freeTextThemes, record.idea.signalAddressed);
    const after = matched ? { count: matched.count, sentiment: matched.sentiment } : null;
    const beforeCount = record.baseline?.count ?? 0;
    const afterCount = after?.count ?? 0;
    const improved = afterCount < beforeCount;

    deps.adoptedIdeaStore.recordOutcome(teamId, record.id, after, improved);
  }
}
