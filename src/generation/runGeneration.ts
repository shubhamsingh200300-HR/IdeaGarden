import type { LlmClient } from "../analysis/llmClient.js";
import { analyzeSignals } from "../analysis/signalAnalysis.js";
import type { OnPremVectorStore } from "../corpus/vectorStore.js";
import type { RequestIntakeStore } from "../requests/requestIntakeStore.js";
import type { DerivedDataStore } from "../uploads/derivedDataStore.js";
import { GeneratedIdeasStore } from "./generatedIdeasStore.js";
import { generateIdeas, type GenerationResult } from "./generateIdeas.js";
import type { IdeaLlmClient } from "./ideaLlmClient.js";

export interface RunGenerationDeps {
  requestIntakeStore: RequestIntakeStore;
  derivedDataStore: DerivedDataStore;
  generatedIdeasStore: GeneratedIdeasStore;
  vectorStore: OnPremVectorStore;
  ideaLlmClient: IdeaLlmClient;
  /** Same theme-extraction client ticket 05's analysis route uses. */
  themeLlmClient: LlmClient;
}

export type RunGenerationResult =
  | { status: "not-ready"; reason: string }
  | { status: "error" }
  | { status: "ok"; result: GenerationResult };

/**
 * Shared orchestration for both the JSON API (generationRoutes.ts) and the
 * HTML regenerate flow (ideaPagesRoutes.ts) - one place that checks
 * readiness, runs analysis + generation, and persists the result, so the
 * two callers can never drift into checking readiness differently.
 */
export async function runGeneration(
  deps: RunGenerationDeps,
  teamId: string,
  additionalContext?: string,
): Promise<RunGenerationResult> {
  const generationRequest = deps.requestIntakeStore.getReadyForGeneration(teamId);
  if (!generationRequest) {
    return { status: "not-ready", reason: "no submitted manager input yet for this team" };
  }

  const processed = deps.derivedDataStore.getLatest(teamId, "annual-survey");
  if (!processed) {
    return { status: "not-ready", reason: "no survey data ingested yet for this team" };
  }

  try {
    const analysis = await analyzeSignals(processed, deps.themeLlmClient);
    const result = await generateIdeas(
      generationRequest,
      analysis,
      { vectorStore: deps.vectorStore, ideaLlmClient: deps.ideaLlmClient },
      additionalContext,
    );
    deps.generatedIdeasStore.save(teamId, result);
    return { status: "ok", result };
  } catch {
    return { status: "error" };
  }
}
