import { Router } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import type { TeamMappingStore } from "./teamMappingStore.js";

export function buildTeamsRouter(teamMappingStore: TeamMappingStore): Router {
  const router = Router();

  router.get("/", requireAuth, (req, res) => {
    const teams = teamMappingStore.getTeamsForHrbp(req.session.hrbpId!);
    res.json({ teams });
  });

  router.get("/:teamId", requireAuth, (req, res) => {
    const hrbpId = req.session.hrbpId!;
    const teamId = String(req.params.teamId);

    const team = teamMappingStore.getTeam(hrbpId, teamId);
    if (!team) {
      res.status(403).json({ error: "forbidden" });
      return;
    }

    res.json(team);
  });

  return router;
}
