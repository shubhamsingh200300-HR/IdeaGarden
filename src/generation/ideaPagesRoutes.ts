import express, { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuthPage } from "../auth/authMiddleware.js";
import { escapeHtml, layout } from "../pages/html.js";
import type { TeamMappingStore } from "../teams/teamMappingStore.js";
import type { PublicIdeaCard } from "./generateIdeas.js";
import { runGeneration, type RunGenerationDeps } from "./runGeneration.js";

const formBody = express.urlencoded({ extended: false });

/** Runs after requireAuthPage, before the form body is parsed - an unauthorized visitor never gets their body buffered. */
function parseFormBody(req: Request, res: Response, next: NextFunction): void {
  formBody(req, res, (err: unknown) => {
    if (err) {
      res.status(400).send(layout("Bad request", "<h1>Bad request</h1><p>Could not read the submitted form.</p>"));
      return;
    }
    next();
  });
}

/**
 * enterpriseIdeaLlmClient.ts parses the LLM response with a bare type
 * assertion, not runtime validation, so `estimatedCostInr` isn't
 * guaranteed to actually be a number at runtime despite its TypeScript
 * type. Number.isFinite (unlike Number()) never coerces a string, so an
 * adversarial/malformed value (including markup) safely falls back to 0
 * instead of bypassing escapeHtml via toLocaleString().
 */
function safeCostInr(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function renderIdeaCard(idea: PublicIdeaCard): string {
  return `<article>
  <h2>${escapeHtml(idea.title)}</h2>
  <p>${escapeHtml(idea.description)}</p>
  <dl>
    <dt>Signal addressed</dt><dd>${escapeHtml(idea.signalAddressed)}</dd>
    <dt>Structural format</dt><dd>${escapeHtml(idea.structuralFormat)}</dd>
    <dt>Ownership</dt><dd>${escapeHtml(idea.ownerRole)}</dd>
    <dt>Sponsorship level</dt><dd>${escapeHtml(idea.sponsorshipLevel)}</dd>
    <dt>Estimated cost</dt><dd>INR ${safeCostInr(idea.estimatedCostInr).toLocaleString("en-IN")}</dd>
    <dt>Estimated effort</dt><dd>${escapeHtml(idea.estimatedEffort)}</dd>
    <dt>Success metric</dt><dd>${escapeHtml(idea.successMetric)}</dd>
  </dl>
</article>`;
}

function renderRegenerateForm(teamId: string): string {
  return `<form method="post" action="/dashboard/teams/${escapeHtml(teamId)}/ideas/generate">
  <label for="additionalContext">Anything to add before regenerating? (optional)</label>
  <textarea id="additionalContext" name="additionalContext"></textarea>
  <button type="submit">Regenerate</button>
</form>`;
}

/**
 * HRBP-only HTML view of generated ideas (ticket 07). Reads the last saved
 * batch (generatedIdeasStore.ts) rather than regenerating on every visit -
 * only the explicit form below triggers a new (costly, external-LLM-
 * calling) generation. Never reachable by the manager: this is mounted
 * under the authenticated /dashboard tree, entirely separate from
 * ticket 10's public /manager/requests/:token surface.
 */
/** HTML-page equivalent of teams/requireTeamAuthorization.ts's JSON-API check: renders an error page instead of a 403 JSON body. Must run after requireAuthPage (needs req.session.hrbpId). */
function requireTeamAuthorizationForPage(teamMappingStore: TeamMappingStore) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const teamId = String(req.params.teamId);
    if (!teamMappingStore.isAuthorized(req.session.hrbpId!, teamId)) {
      res
        .status(403)
        .send(layout("Not authorized", "<h1>Not authorized</h1><p>You don't have access to this team.</p>"));
      return;
    }
    next();
  };
}

export function buildIdeaPagesRoutes(deps: RunGenerationDeps, teamMappingStore: TeamMappingStore): Router {
  const router = Router();
  const authorize = requireTeamAuthorizationForPage(teamMappingStore);

  router.get("/teams/:teamId/ideas", requireAuthPage, authorize, (req, res) => {
    const teamId = String(req.params.teamId);

    const latest = deps.generatedIdeasStore.getLatest(teamId);
    const body = latest
      ? `<h1>Generated ideas</h1>${latest.ideas.map(renderIdeaCard).join("")}${renderRegenerateForm(teamId)}`
      : `<h1>Generated ideas</h1><p>Nothing generated yet.</p>${renderRegenerateForm(teamId).replace(">Regenerate<", ">Generate<")}`;

    res.status(200).send(layout("Generated ideas", body));
  });

  router.post("/teams/:teamId/ideas/generate", requireAuthPage, authorize, parseFormBody, async (req, res) => {
    const teamId = String(req.params.teamId);

    const additionalContext =
      typeof req.body?.additionalContext === "string" && req.body.additionalContext.trim()
        ? req.body.additionalContext
        : undefined;

    const outcome = await runGeneration(deps, teamId, additionalContext);

    if (outcome.status === "not-ready") {
      res
        .status(409)
        .send(layout("Not ready", `<h1>Not ready</h1><p>${escapeHtml(outcome.reason)}</p>`));
      return;
    }
    if (outcome.status === "error") {
      res
        .status(502)
        .send(layout("Generation failed", "<h1>Generation failed</h1><p>Please try again shortly.</p>"));
      return;
    }

    res.redirect(303, `/dashboard/teams/${teamId}/ideas`);
  });

  return router;
}
