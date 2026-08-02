import { Router } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { requireTeamAuthorization } from "../teams/requireTeamAuthorization.js";
import type { TeamMappingStore } from "../teams/teamMappingStore.js";
import type { DerivedDataStore } from "../uploads/derivedDataStore.js";
import { SOURCE_TYPES, type SourceType } from "../uploads/rawFileStore.js";
import type { LlmClient } from "./llmClient.js";
import { analyzeSignals } from "./signalAnalysis.js";

const DEFAULT_SOURCE_TYPE: SourceType = "annual-survey";

export interface AnalysisDeps {
  derivedDataStore: DerivedDataStore;
  llmClient: LlmClient;
}

export function buildAnalysisRoutes(
  { derivedDataStore, llmClient }: AnalysisDeps,
  teamMappingStore: TeamMappingStore,
): Router {
  const router = Router();
  const authorize = requireTeamAuthorization(teamMappingStore);

  router.get("/:teamId/analysis", requireAuth, authorize, async (req, res) => {
    const teamId = String(req.params.teamId);
    const requestedSource = req.query.source;
    const sourceType = (SOURCE_TYPES as readonly string[]).includes(requestedSource as string)
      ? (requestedSource as SourceType)
      : DEFAULT_SOURCE_TYPE;

    const processed = derivedDataStore.getLatest(teamId, sourceType);
    if (!processed) {
      res.status(404).json({ error: `no ${sourceType} data has been ingested for this team yet` });
      return;
    }

    const summary = await analyzeSignals(processed, llmClient);
    res.status(200).json(summary);
  });

  return router;
}
