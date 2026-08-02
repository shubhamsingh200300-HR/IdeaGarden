import type { NextFunction, Request, Response } from "express";
import type { TeamMappingStore } from "./teamMappingStore.js";

/** Must run after requireAuth (needs req.session.hrbpId) and before any request-body parsing. */
export function requireTeamAuthorization(teamMappingStore: TeamMappingStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const hrbpId = req.session.hrbpId!;
    const teamId = String(req.params.teamId);
    if (!teamMappingStore.isAuthorized(hrbpId, teamId)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    next();
  };
}
