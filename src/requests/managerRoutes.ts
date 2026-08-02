import express, { Router, type NextFunction, type Request, type Response } from "express";
import { escapeHtml, layout } from "../pages/html.js";
import { RequestIntakeStore, type RequestConstraints, type TokenCheckResult } from "./requestIntakeStore.js";

const formBody = express.urlencoded({ extended: false });

const ERROR_STATUS: Record<Exclude<TokenCheckResult, { ok: true }>["reason"], number> = {
  "not-found": 404,
  expired: 410,
  "already-submitted": 409,
};

const ERROR_MESSAGE: Record<Exclude<TokenCheckResult, { ok: true }>["reason"], string> = {
  "not-found": "This link is invalid or not found.",
  expired: "This link has expired.",
  "already-submitted": "This link has already been used.",
};

function renderError(res: Response, reason: Exclude<TokenCheckResult, { ok: true }>["reason"]): void {
  res.status(ERROR_STATUS[reason]).send(
    layout("Link not available", `<h1>Link not available</h1><p>${ERROR_MESSAGE[reason]}</p>`),
  );
}

function renderForm(res: Response, token: string): void {
  res.status(200).send(
    layout(
      "Share your input",
      `<h1>Share your input</h1>
<form method="post" action="/manager/requests/${escapeHtml(token)}">
  <label for="context">What's going on with your team?</label>
  <textarea id="context" name="context" required></textarea>
  <label for="budget">Budget</label>
  <input id="budget" name="budget" type="text" />
  <label for="time">Time</label>
  <input id="time" name="time" type="text" />
  <label for="headcountLogistics">Headcount / logistics</label>
  <input id="headcountLogistics" name="headcountLogistics" type="text" />
  <button type="submit">Submit</button>
</form>`,
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
      res.status(400).send(layout("Bad request", "<h1>Bad request</h1><p>Could not read the submitted form.</p>"));
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
        .send(layout("Missing context", "<h1>Missing context</h1><p>Please describe what's going on before submitting.</p>"));
      return;
    }

    const result = requestIntakeStore.submitByToken(String(req.params.token), context, readConstraints(req.body ?? {}));
    if (!result.ok) {
      renderError(res, result.reason);
      return;
    }

    res.status(200).send(layout("Thanks", "<h1>Thanks!</h1><p>Your input has been submitted.</p>"));
  });

  return router;
}
