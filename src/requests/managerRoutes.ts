import express, { Router, type NextFunction, type Request, type Response } from "express";
import { escapeHtml, layout, pageHeader } from "../pages/html.js";
import { RequestIntakeStore, type RequestConstraints, type TokenCheckResult } from "./requestIntakeStore.js";

const formBody = express.urlencoded({ extended: false });

const ERROR_STATUS: Record<Exclude<TokenCheckResult, { ok: true }>["reason"], number> = {
  "not-found": 404,
  expired: 410,
  "already-submitted": 409,
};

const ERROR_MESSAGE: Record<Exclude<TokenCheckResult, { ok: true }>["reason"], string> = {
  "not-found": "This link is invalid or not found. Ask your HRBP to send a fresh one.",
  expired: "This link has expired. Ask your HRBP to send a fresh one.",
  "already-submitted": "This link has already been used — your input was already recorded.",
};

function renderMessagePage(title: string, message: string): string {
  return layout(title, `<div class="stack">${pageHeader("Idea Garden", title, message)}</div>`, {
    narrow: true,
    centered: true,
  });
}

function renderError(res: Response, reason: Exclude<TokenCheckResult, { ok: true }>["reason"]): void {
  res.status(ERROR_STATUS[reason]).send(renderMessagePage("Link not available", ERROR_MESSAGE[reason]));
}

function renderForm(res: Response, token: string): void {
  res.status(200).send(
    layout(
      "Share your input",
      `<div class="stack">
  ${pageHeader(
    "For engineering managers",
    "Share your input",
    "Your HRBP is diagnosing what's really going on with your team and designing a structural response — not another team outing. A few honest sentences and a sense of your constraints is all this needs.",
  )}
  <form method="post" action="/manager/requests/${escapeHtml(token)}">
    <div class="field">
      <label class="label-question" for="context">What's going on with your team?</label>
      <textarea id="context" name="context" required></textarea>
    </div>
    <div class="field">
      <label>Constraints</label>
      <div class="constraint-grid">
        <div>
          <label for="budget">Budget</label>
          <input id="budget" name="budget" type="text" placeholder="up to ₹50,000" />
        </div>
        <div>
          <label for="time">Time</label>
          <input id="time" name="time" type="text" placeholder="half a day" />
        </div>
        <div>
          <label for="headcountLogistics">Headcount / logistics</label>
          <input id="headcountLogistics" name="headcountLogistics" type="text" placeholder="team of 8" />
        </div>
      </div>
    </div>
    <button class="btn" type="submit">Submit</button>
  </form>
</div>`,
      { narrow: true },
    ),
  );
}

function readConstraints(body: Record<string, unknown>): RequestConstraints {
  const field = (name: string) => (typeof body[name] === "string" ? (body[name] as string) : "");
  return { budget: field("budget"), time: field("time"), headcountLogistics: field("headcountLogistics") };
}

/** Wraps express.urlencoded so a malformed form body becomes a clean 400, not a generic 500. */
function parseFormBody(req: Request, res: Response, next: NextFunction): void {
  formBody(req, res, (err: unknown) => {
    if (err) {
      res.status(400).send(renderMessagePage("Bad request", "Could not read the submitted form."));
      return;
    }
    next();
  });
}

/**
 * Public, unauthenticated, token-gated - the manager's only access point
 * (ticket 10). Deliberately outside /api/teams: no Knox session, no team
 * mapping check, just the token itself as the access control.
 */
export function buildManagerRoutes(requestIntakeStore: RequestIntakeStore): Router {
  const router = Router();

  router.get("/:token", (req, res) => {
    const check = requestIntakeStore.checkToken(String(req.params.token));
    if (!check.ok) {
      renderError(res, check.reason);
      return;
    }
    renderForm(res, String(req.params.token));
  });

  router.post("/:token", parseFormBody, (req, res) => {
    const context = typeof req.body?.context === "string" ? req.body.context.trim() : "";
    if (!context) {
      res
        .status(400)
        .send(renderMessagePage("Missing context", "Please describe what's going on before submitting."));
      return;
    }

    const result = requestIntakeStore.submitByToken(String(req.params.token), context, readConstraints(req.body ?? {}));
    if (!result.ok) {
      renderError(res, result.reason);
      return;
    }

    res
      .status(200)
      .send(renderMessagePage("Thanks", "Thank you — your input has been submitted and your HRBP has been notified."));
  });

  return router;
}
