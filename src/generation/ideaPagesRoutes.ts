import express, { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuthPage } from "../auth/authMiddleware.js";
import { escapeHtml, layout } from "../pages/html.js";
import type { TeamMappingStore } from "../teams/teamMappingStore.js";
import { adoptIdea } from "../tracking/adoptIdea.js";
import type { AdoptedIdea } from "../tracking/adoptedIdeaStore.js";
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

function renderIdeaCard(idea: PublicIdeaCard, index: number, teamId: string): string {
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
  <form method="post" action="/dashboard/teams/${escapeHtml(teamId)}/ideas/adopt">
    <input type="hidden" name="ideaIndex" value="${index}" />
    <button type="submit">Mark as adopted</button>
  </form>
</article>`;
}

function renderBaselineText(baseline: AdoptedIdea["baseline"]): string {
  if (!baseline) return "no baseline available";
  return `${baseline.count} mention(s), ${escapeHtml(baseline.sentiment)}`;
}

function renderOutcomeText(outcome: AdoptedIdea["outcome"]): string {
  if (!outcome) return "awaiting the next survey cycle";

  const verdict = outcome.improved ? "improved" : "no improvement yet";
  if (!outcome.after) return `no longer surfaced — ${verdict}`;
  return `${outcome.after.count} mention(s), ${escapeHtml(outcome.after.sentiment)} — ${verdict}`;
}

/** Ticket 08: HRBP-facing before/after for each of this team's adopted ideas - the third checkbox's "surfaced to the HRBP". */
function renderAdoptedSection(records: AdoptedIdea[]): string {
  if (records.length === 0) return "";

  const items = records.map((record) => {
    const before = renderBaselineText(record.baseline);
    const after = renderOutcomeText(record.outcome);
    return `<li><strong>${escapeHtml(record.idea.title)}</strong> (adopted ${escapeHtml(record.adoptedAt)}) — Before: ${before}. After: ${after}.</li>`;
  });

  return `<h2>Adopted ideas</h2><ul>${items.join("")}</ul>`;
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
    const ideasBody = latest
      ? `<h1>Generated ideas</h1>${latest.ideas.map((idea, index) => renderIdeaCard(idea, index, teamId)).join("")}${renderRegenerateForm(teamId)}`
      : `<h1>Generated ideas</h1><p>Nothing generated yet.</p>${renderRegenerateForm(teamId).replace(">Regenerate<", ">Generate<")}`;
    const adoptedBody = renderAdoptedSection(deps.adoptedIdeaStore.list(teamId));

    res.status(200).send(layout("Generated ideas", `${ideasBody}${adoptedBody}`));
  });

  router.post("/teams/:teamId/ideas/adopt", requireAuthPage, authorize, parseFormBody, async (req, res) => {
    const teamId = String(req.params.teamId);
    const ideaIndex = Number(req.body?.ideaIndex);

    if (!Number.isInteger(ideaIndex) || ideaIndex < 0) {
      res.status(400).send(layout("Bad request", "<h1>Bad request</h1><p>Invalid idea.</p>"));
      return;
    }

    const outcome = await adoptIdea(deps, teamId, ideaIndex);
    if (outcome.status === "not-found") {
      res.status(404).send(layout("Not found", "<h1>Not found</h1><p>That idea could not be found.</p>"));
      return;
    }

    res.redirect(303, `/dashboard/teams/${teamId}/ideas`);
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
