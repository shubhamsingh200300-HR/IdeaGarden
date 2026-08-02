import { Router } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { requireTeamAuthorization } from "../teams/requireTeamAuthorization.js";
import type { TeamMappingStore } from "../teams/teamMappingStore.js";
import type { RequestIntakeStore } from "../requests/requestIntakeStore.js";
import type { DerivedDataStore } from "../uploads/derivedDataStore.js";
import type { OnPremVectorStore } from "../corpus/vectorStore.js";
import type { LlmClient } from "../analysis/llmClient.js";
import { analyzeSignals } from "../analysis/signalAnalysis.js";
import type { IdeaLlmClient } from "./ideaLlmClient.js";
import { generateIdeas } from "./generateIdeas.js";

export interface GenerationRouteDeps {
  requestIntakeStore: RequestIntakeStore;
  derivedDataStore: DerivedDataStore;
  vectorStore: OnPremVectorStore;
  ideaLlmClient: IdeaLlmClient;
  /** Same theme-extraction client ticket 05's analysis route uses. */
  themeLlmClient: LlmClient;
}

export function buildGenerationRoutes(
  deps: GenerationRouteDeps,
  teamMappingStore: TeamMappingStore,
): Router {
  const router = Router();
  const authorize = requireTeamAuthorization(teamMappingStore);

  router.post("/:teamId/ideas/generate", requireAuth, authorize, async (req, res) => {
    const teamId = String(req.params.teamId);

    const generationRequest = deps.requestIntakeStore.getReadyForGeneration(teamId);
    if (!generationRequest) {
      res.status(409).json({ error: "no submitted manager input yet for this team" });
      return;
    }

    const processed = deps.derivedDataStore.getLatest(teamId, "annual-survey");
    if (!processed) {
      res.status(409).json({ error: "no survey data ingested yet for this team" });
      return;
    }

    try {
      const analysis = await analyzeSignals(processed, deps.themeLlmClient);
      const result = await generateIdeas(generationRequest, analysis, {
        vectorStore: deps.vectorStore,
        ideaLlmClient: deps.ideaLlmClient,
      });

      res.status(200).json(result);
    } catch {
      // Don't leak internal error detail (could include LLM response
      // bodies) to the client; 502 signals an upstream dependency failure
      // rather than a bug in this request itself.
      res.status(502).json({ error: "idea generation failed - the upstream analysis or generation service errored" });
    }
  });

  return router;
}
