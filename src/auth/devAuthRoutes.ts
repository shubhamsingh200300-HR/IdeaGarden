import { Router } from "express";
import { layout } from "../pages/html.js";

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
        `<h1>Dev login</h1>
<p>Local testing only — logs in as whatever email you enter, no verification.</p>
<form method="post" action="/auth/dev-login">
  <input type="email" name="email" placeholder="you@example.com" required />
  <button type="submit">Log in</button>
</form>`,
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
