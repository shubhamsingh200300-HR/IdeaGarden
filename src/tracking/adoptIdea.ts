import type { LlmClient } from "../analysis/llmClient.js";
import { analyzeSignals } from "../analysis/signalAnalysis.js";
import type { GeneratedIdeasStore } from "../generation/generatedIdeasStore.js";
import type { DerivedDataStore } from "../uploads/derivedDataStore.js";
import { AdoptedIdeaStore, type AdoptedIdea } from "./adoptedIdeaStore.js";
import { findMatchingTheme } from "./signalMatch.js";

export interface AdoptIdeaDeps {
  generatedIdeasStore: GeneratedIdeasStore;
  derivedDataStore: DerivedDataStore;
  themeLlmClient: LlmClient;
  adoptedIdeaStore: AdoptedIdeaStore;
}

export type AdoptIdeaResult = { status: "not-found" } | { status: "ok"; record: AdoptedIdea };

/**
 * Marks one idea from the team's latest generated batch (ticket 07) as
 * adopted (ticket 08), capturing a baseline snapshot of its targeted
 * signal from the survey data still current at adoption time - this is
 * the only chance to capture it, since DerivedDataStore only ever keeps
 * the latest cycle's data and the next upload will overwrite it.
 */
export async function adoptIdea(deps: AdoptIdeaDeps, teamId: string, ideaIndex: number): Promise<AdoptIdeaResult> {
  const latest = deps.generatedIdeasStore.getLatest(teamId);
  const idea = latest?.ideas[ideaIndex];
  if (!idea) return { status: "not-found" };

  const processed = deps.derivedDataStore.getLatest(teamId, "annual-survey");
  let baseline = null;
  if (processed) {
    const analysis = await analyzeSignals(processed, deps.themeLlmClient);
    const matched = findMatchingTheme(analysis.freeTextThemes, idea.signalAddressed);
    baseline = matched ? { count: matched.count, sentiment: matched.sentiment } : null;
  }

  const record = deps.adoptedIdeaStore.adopt(teamId, idea, baseline);
  return { status: "ok", record };
}
