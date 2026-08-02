import { Router } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { requireTeamAuthorization } from "../teams/requireTeamAuthorization.js";
import type { TeamMappingStore } from "../teams/teamMappingStore.js";
import { RequestIntakeStore } from "./requestIntakeStore.js";
import { managerLinkFor } from "./managerLink.js";

/**
 * HRBP-facing: trigger an invite, check its status. The manager submits
 * separately, through managerRoutes.ts's unauthenticated-but-token-gated
 * endpoint - the HRBP no longer types anything on the manager's behalf
 * (ticket 10, superseding ticket 04's original HRBP-relay assumption).
 */
export function buildRequestRoutes(
  requestIntakeStore: RequestIntakeStore,
  teamMappingStore: TeamMappingStore,
  /** Omit to use RequestIntakeStore's own default (7 days) - actually operator-configurable via MANAGER_INVITE_EXPIRY_MS in server.ts, not just a theoretical parameter. */
  inviteExpiryMs?: number,
): Router {
  const router = Router();
  const authorize = requireTeamAuthorization(teamMappingStore);

  router.post("/:teamId/requests/invite", requireAuth, authorize, (req, res) => {
    const teamId = String(req.params.teamId);
    const invite =
      inviteExpiryMs === undefined
        ? requestIntakeStore.createInvite(teamId, req.session.hrbpId!)
        : requestIntakeStore.createInvite(teamId, req.session.hrbpId!, inviteExpiryMs);

    res.status(201).json({ ...invite, link: managerLinkFor(req, invite.token!) });
  });

  router.get("/:teamId/requests/latest", requireAuth, authorize, (req, res) => {
    const latest = requestIntakeStore.getLatest(String(req.params.teamId));
    if (!latest) {
      res.status(404).json({ error: "no request submitted for this team yet" });
      return;
    }
    res.status(200).json(latest);
  });

  return router;
}
