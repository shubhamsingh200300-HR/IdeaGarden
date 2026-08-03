import express, { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuth } from "../auth/authMiddleware.js";
import { approveProposal, type ApproveProposalDeps } from "./approveProposal.js";
import type { CorpusEntry } from "./parseBenchmarkCorpus.js";

const jsonBody = express.json();

/** Scoped (not app-wide) so an unauthenticated request never gets its body parsed - same reasoning as every other JSON route in this codebase. */
function parseJsonBody(req: Request, res: Response, next: NextFunction): void {
  jsonBody(req, res, (err: unknown) => {
    if (err) {
      res.status(400).json({ error: "malformed request body" });
      return;
    }
    next();
  });
}

function parseProposalInput(body: unknown): Omit<CorpusEntry, "id"> {
  const b = (body ?? {}) as Record<string, unknown>;
  return {
    company: String(b.company ?? ""),
    initiative: String(b.initiative ?? ""),
    primarySignal: String(b.primarySignal ?? ""),
    secondarySignals: Array.isArray(b.secondarySignals) ? b.secondarySignals.map(String) : [],
    structure: String(b.structure ?? ""),
    impactEvidence: String(b.impactEvidence ?? ""),
    sources: Array.isArray(b.sources) ? b.sources.map(String) : [],
  };
}

/** These routes are exactly what ApproveProposalDeps already needs (proposalStore, vectorStore, corpusFilePath) - no additional dependency of its own. */
export type CorpusRoutesDeps = ApproveProposalDeps;

/**
 * Corpus content is global (not team-scoped) shared infrastructure, so
 * these routes gate on requireAuth alone rather than
 * requireTeamAuthorization. Disclosed limitation: there's no separate
 * corpus-curator role in this system yet, so any authenticated HRBP can
 * propose, review, approve, or reject - the same trust boundary every
 * other authenticated endpoint in this app currently uses.
 *
 * "A research agent can be run to propose candidate new corpus entries"
 * (ticket 09's first checkbox) is satisfied by this endpoint existing as a
 * submission surface, not by this app running a research agent itself -
 * the original 71 entries were themselves produced by a human-invoked
 * `/research` subagent working outside this app (wayfinder/research/
 * benchmark-corpus.md), and a proposal is expected to arrive the same way:
 * a human or agent researches candidates elsewhere, then POSTs the result
 * here for review. The sourcing-standard check below is deliberately only
 * a minimum structural gate (non-empty, URL-shaped sources) - judging
 * whether a source is genuinely primary/attributed is exactly what the
 * ticket's second checkbox (explicit human review) exists to catch;
 * automating that judgment would need fetching and assessing arbitrary
 * URLs, well beyond this ticket's scope.
 */
export function buildCorpusRoutes(deps: CorpusRoutesDeps): Router {
  const router = Router();

  router.post("/proposals", requireAuth, parseJsonBody, (req, res) => {
    const input = parseProposalInput(req.body);
    const existingCorpusIds = deps.vectorStore.listEntries().map((entry) => entry.id);
    const result = deps.proposalStore.propose(input, existingCorpusIds);

    if (result.status === "invalid") {
      res.status(400).json({ error: "proposal rejected", issues: result.issues });
      return;
    }
    res.status(201).json(result.proposal);
  });

  router.get("/proposals", requireAuth, (req, res) => {
    const status = req.query.status;
    const proposals = status === "pending" ? deps.proposalStore.listPending() : deps.proposalStore.listAll();
    res.status(200).json(proposals);
  });

  router.post("/proposals/:entryId/approve", requireAuth, (req, res) => {
    const result = approveProposal(deps, String(req.params.entryId));

    if (result.status === "not-found") {
      res.status(404).json({ error: "no such proposal" });
    } else if (result.status === "already-decided") {
      res.status(409).json({ error: "this proposal has already been decided" });
    } else {
      res.status(200).json(result.entry);
    }
  });

  router.post("/proposals/:entryId/reject", requireAuth, (req, res) => {
    const result = deps.proposalStore.decide(String(req.params.entryId), "rejected");

    if (result.status === "not-found") {
      res.status(404).json({ error: "no such proposal" });
    } else if (result.status === "already-decided") {
      res.status(409).json({ error: "this proposal has already been decided" });
    } else {
      res.status(200).json(result.proposal);
    }
  });

  return router;
}
