import { randomUUID } from "node:crypto";
import express, { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { requireTeamAuthorization } from "../teams/requireTeamAuthorization.js";
import type { TeamMappingStore } from "../teams/teamMappingStore.js";
import { RequestIntakeStore, type RequestConstraints } from "./requestIntakeStore.js";

const jsonBody = express.json();

/** Scoped (not app-wide) so an unauthorized request never gets its body parsed - same reasoning as uploadRoutes.ts's multer ordering. */
function parseJsonBody(req: Request, res: Response, next: NextFunction): void {
  jsonBody(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: "malformed request body" });
      return;
    }
    next();
  });
}

type ConstraintsValidation = { ok: true; constraints: RequestConstraints } | { ok: false; field: string };

/** Missing constraint fields default to "" (optional); a field that's present but not a string is rejected, not silently dropped. */
function validateConstraints(input: unknown): ConstraintsValidation {
  const raw = (input ?? {}) as Record<string, unknown>;
  const constraints: RequestConstraints = { budget: "", time: "", headcountLogistics: "" };

  for (const field of ["budget", "time", "headcountLogistics"] as const) {
    if (field in raw) {
      if (typeof raw[field] !== "string") return { ok: false, field };
      constraints[field] = raw[field];
    }
  }

  return { ok: true, constraints };
}

/**
 * Ticket 04's manager-input-relay assumption: the HRBP enters the manager's
 * free-text context and constraints on their behalf during intake, since
 * managers never use the platform directly (content spec ticket 002/008).
 */
export function buildRequestRoutes(
  requestIntakeStore: RequestIntakeStore,
  teamMappingStore: TeamMappingStore,
): Router {
  const router = Router();
  const authorize = requireTeamAuthorization(teamMappingStore);

  router.post("/:teamId/requests", requireAuth, authorize, parseJsonBody, (req, res) => {
    const context = typeof req.body?.context === "string" ? req.body.context.trim() : "";
    if (!context) {
      res.status(400).json({ error: "context is required" });
      return;
    }

    const constraintsResult = validateConstraints(req.body?.constraints);
    if (!constraintsResult.ok) {
      res.status(400).json({ error: `constraints.${constraintsResult.field} must be a string` });
      return;
    }

    const generationRequest = {
      id: randomUUID(),
      teamId: String(req.params.teamId),
      hrbpId: req.session.hrbpId!,
      context,
      constraints: constraintsResult.constraints,
      submittedAt: new Date().toISOString(),
    };

    requestIntakeStore.save(generationRequest);
    res.status(201).json(generationRequest);
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
