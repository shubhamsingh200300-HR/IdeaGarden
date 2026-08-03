import { Router } from "express";
import { layout, pageHeader } from "../pages/html.js";

/**
 * Local-testing-only login: authenticates as whatever email is typed in,
 * with no identity verification at all. Never mounted unless devLoginEnabled
 * is explicitly set (see app.ts) — must never be reachable in a real
 * deployment, since it bypasses Knox entirely.
 */
export function buildDevAuthRouter(): Router {
  const router = Router();

  router.get("/dev-login", (_req, res) => {
    res.send(
      layout(
        "Dev login",
        `<div class="stack">
  ${pageHeader("Local testing only", "Dev login")}
  <div class="banner banner--warning">
    <p>Logs in as whatever email you enter, with no verification. Never available outside a developer's own machine.</p>
  </div>
  <form method="post" action="/auth/dev-login">
    <div class="field">
      <label for="email">Email</label>
      <input id="email" type="email" name="email" placeholder="you@example.com" required />
    </div>
    <button class="btn" type="submit">Log in</button>
  </form>
</div>`,
        { narrow: true, centered: true },
      ),
    );
  });

  router.post("/dev-login", (req, res) => {
    const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!email) {
      res.status(400).send("email is required");
      return;
    }
    req.session.hrbpId = email;
    res.redirect("/dashboard");
  });

  return router;
}
