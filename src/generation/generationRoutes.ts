import express, { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { requireTeamAuthorization } from "../teams/requireTeamAuthorization.js";
import type { TeamMappingStore } from "../teams/teamMappingStore.js";
import { runGeneration, type RunGenerationDeps } from "./runGeneration.js";

const jsonBody = express.json();

/** Scoped (not app-wide) so an unauthorized request never gets its body parsed - same reasoning as uploadRoutes.ts's multer ordering and requestRoutes.ts's scoped express.json(). */
function parseJsonBody(req: Request, res: Response, next: NextFunction): void {
  jsonBody(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: "malformed request body" });
      return;
    }
    next();
  });
}

export function buildGenerationRoutes(
  deps: RunGenerationDeps,
  teamMappingStore: TeamMappingStore,
): Router {
  const router = Router();
  const authorize = requireTeamAuthorization(teamMappingStore);

  router.post("/:teamId/ideas/generate", requireAuth, authorize, parseJsonBody, async (req, res) => {
    const teamId = String(req.params.teamId);
    const additionalContext =
      typeof req.body?.additionalContext === "string" ? req.body.additionalContext : undefined;

    const outcome = await runGeneration(deps, teamId, additionalContext);

    if (outcome.status === "not-ready") {
      res.status(409).json({ error: outcome.reason });
    } else if (outcome.status === "error") {
      // Don't leak internal error detail (could include LLM response
      // bodies) to the client; 502 signals an upstream dependency failure
      // rather than a bug in this request itself.
      res.status(502).json({ error: "idea generation failed - the upstream analysis or generation service errored" });
    } else {
      res.status(200).json(outcome.result);
    }
  });

  router.get("/:teamId/ideas/latest", requireAuth, authorize, (req, res) => {
    const latest = deps.generatedIdeasStore.getLatest(String(req.params.teamId));
    if (!latest) {
      res.status(404).json({ error: "no ideas have been generated for this team yet" });
      return;
    }
    res.status(200).json(latest);
  });

  return router;
}
