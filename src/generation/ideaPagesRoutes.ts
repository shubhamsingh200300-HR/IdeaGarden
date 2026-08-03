import express, { Router, type NextFunction, type Request, type Response } from "express";
import { requireAuthPage } from "../auth/authMiddleware.js";
import { escapeHtml, layout, pageHeader } from "../pages/html.js";
import type { TeamMappingStore } from "../teams/teamMappingStore.js";
import { adoptIdea } from "../tracking/adoptIdea.js";
import type { AdoptedIdea } from "../tracking/adoptedIdeaStore.js";
import type { PublicIdeaCard } from "./generateIdeas.js";
import type { SponsorshipLevel } from "./ideaLlmClient.js";
import { runGeneration, type RunGenerationDeps } from "./runGeneration.js";

const formBody = express.urlencoded({ extended: false });

/** Runs after requireAuthPage, before the form body is parsed - an unauthorized visitor never gets their body buffered. */
function parseFormBody(req: Request, res: Response, next: NextFunction): void {
  formBody(req, res, (err: unknown) => {
    if (err) {
      res.status(400).send(renderNotice("Bad request", "Could not read the submitted form."));
      return;
    }
    next();
  });
}

function renderNotice(title: string, message: string, headerMeta?: string): string {
  return layout(
    title,
    `<div class="stack">
  ${pageHeader("Idea Garden", title)}
  <div class="banner banner--warning"><p>${escapeHtml(message)}</p></div>
</div>`,
    { narrow: true, headerMeta },
  );
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

const SPONSORSHIP_STAMP_CLASS: Record<SponsorshipLevel, string> = {
  team: "stamp",
  org: "stamp stamp--org",
  exec: "stamp stamp--exec",
};

function fieldRow(label: string, valueHtml: string): string {
  return `<div class="field-row"><dt>${escapeHtml(label)}</dt><dd>${valueHtml}</dd></div>`;
}

/**
 * One idea rendered as an evidence card: a docket eyebrow naming the signal
 * it was diagnosed from, the prescription itself, then every field ticket
 * 07 requires as a labelled row - no internal score is shown anywhere here.
 */
function renderIdeaCard(idea: PublicIdeaCard, index: number, teamId: string): string {
  const stampClass = SPONSORSHIP_STAMP_CLASS[idea.sponsorshipLevel] ?? "stamp";

  return `<article class="card idea-card card--tab">
  <p class="signal-tag">Signal — ${escapeHtml(idea.signalAddressed)}</p>
  <h2>${escapeHtml(idea.title)}</h2>
  <p>${escapeHtml(idea.description)}</p>
  <dl class="fields">
    ${fieldRow("Structural format", escapeHtml(idea.structuralFormat))}
    ${fieldRow("Ownership", escapeHtml(idea.ownerRole))}
    ${fieldRow("Sponsorship level", `<span class="${stampClass}">${escapeHtml(idea.sponsorshipLevel)}</span>`)}
    ${fieldRow("Estimated cost", `<span class="cost">INR ${safeCostInr(idea.estimatedCostInr).toLocaleString("en-IN")}</span>`)}
    ${fieldRow("Estimated effort", escapeHtml(idea.estimatedEffort))}
    ${fieldRow("Success metric", escapeHtml(idea.successMetric))}
  </dl>
  <form method="post" action="/dashboard/teams/${escapeHtml(teamId)}/ideas/adopt">
    <input type="hidden" name="ideaIndex" value="${index}" />
    <button class="btn" type="submit">Mark as adopted</button>
  </form>
</article>`;
}

function renderBaselineText(baseline: AdoptedIdea["baseline"]): string {
  if (!baseline) return "no baseline available";
  return `${baseline.count} mention(s), ${escapeHtml(baseline.sentiment)}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return escapeHtml(iso);
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * The outcome ledger (ticket 08's third checkbox: the before/after
 * comparison surfaced to the HRBP) - the one place in this product where a
 * diagnosis, a prescription, and a measured result are shown together as a
 * single line. Verdict text stays lowercase in the markup (CSS renders it
 * as an uppercase stamp) - see .verdict in styles.css.
 */
function renderLedgerRow(record: AdoptedIdea): string {
  const before = renderBaselineText(record.baseline);
  const meta = `<div class="ledger-row__meta">
      <span class="ledger-row__title">${escapeHtml(record.idea.title)}</span>
      <span class="ledger-row__date">Adopted ${formatDate(record.adoptedAt)}</span>
    </div>`;

  if (!record.outcome) {
    return `<li class="ledger-row">${meta}
    <div class="ledger-delta">
      <span class="ledger-delta__before">${before}</span>
      <span class="text-muted">— awaiting the next survey cycle</span>
    </div>
  </li>`;
  }

  const verdictLabel = record.outcome.improved ? "improved" : "no improvement yet";
  const verdictClass = record.outcome.improved ? "verdict--improved" : "verdict--pending";
  const after = record.outcome.after
    ? `${record.outcome.after.count} mention(s), ${escapeHtml(record.outcome.after.sentiment)}`
    : "no longer surfaced";

  return `<li class="ledger-row">${meta}
    <div class="ledger-delta">
      <span class="ledger-delta__before">${before}</span>
      <span class="ledger-delta__arrow" aria-hidden="true">&rarr;</span>
      <span class="ledger-delta__after">${after}</span>
      <span class="verdict ${verdictClass}">${verdictLabel}</span>
    </div>
  </li>`;
}

function renderAdoptedSection(records: AdoptedIdea[]): string {
  if (records.length === 0) return "";
  return `<section class="stack">
  <h2 style="font-size:var(--text-lg)">Adopted ideas</h2>
  <ul class="ledger card card--quiet">${records.map(renderLedgerRow).join("")}</ul>
</section>`;
}

function renderRegenerateForm(teamId: string, hasBatch: boolean): string {
  return `<div class="card refine-panel card--quiet">
  <p class="eyebrow">${hasBatch ? "Refine" : "Get started"}</p>
  <form method="post" action="/dashboard/teams/${escapeHtml(teamId)}/ideas/generate">
    <div class="field">
      <label class="label-question" for="additionalContext">Anything to add before ${hasBatch ? "regenerating" : "generating"}? (optional)</label>
      <textarea id="additionalContext" name="additionalContext"></textarea>
    </div>
    <button class="btn ${hasBatch ? "btn-secondary" : ""}" type="submit">${hasBatch ? "Regenerate" : "Generate"}</button>
  </form>
</div>`;
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
      res.status(403).send(renderNotice("Not authorized", "You don't have access to this team."));
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
    const hrbpId = req.session.hrbpId!;

    const latest = deps.generatedIdeasStore.getLatest(teamId);
    const ideasBody = latest
      ? `${pageHeader("Generated ideas", "Prescriptions for this team")}${latest.ideas
          .map((idea, index) => renderIdeaCard(idea, index, teamId))
          .join("")}${renderRegenerateForm(teamId, true)}`
      : `${pageHeader("Generated ideas", "Nothing generated yet", "Once your manager's input and a survey are both in, generate this team's first batch of evidence-grounded ideas.")}${renderRegenerateForm(teamId, false)}`;
    const adoptedBody = renderAdoptedSection(deps.adoptedIdeaStore.list(teamId));

    res.status(200).send(
      layout("Generated ideas", `<div class="stack">${ideasBody}${adoptedBody}</div>`, {
        headerMeta: escapeHtml(hrbpId),
      }),
    );
  });

  router.post("/teams/:teamId/ideas/adopt", requireAuthPage, authorize, parseFormBody, async (req, res) => {
    const teamId = String(req.params.teamId);
    const ideaIndex = Number(req.body?.ideaIndex);

    if (!Number.isInteger(ideaIndex) || ideaIndex < 0) {
      res.status(400).send(renderNotice("Bad request", "Invalid idea."));
      return;
    }

    const outcome = await adoptIdea(deps, teamId, ideaIndex);
    if (outcome.status === "not-found") {
      res.status(404).send(renderNotice("Not found", "That idea could not be found."));
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
      res.status(409).send(renderNotice("Not ready", outcome.reason));
      return;
    }
    if (outcome.status === "error") {
      res.status(502).send(renderNotice("Generation failed", "Please try again shortly."));
      return;
    }

    res.redirect(303, `/dashboard/teams/${teamId}/ideas`);
  });

  return router;
}
