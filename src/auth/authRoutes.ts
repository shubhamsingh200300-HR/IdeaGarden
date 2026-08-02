import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { OidcClient } from "./oidcClient.js";

export function buildAuthRouter(oidcClient: OidcClient): Router {
  const router = Router();

  router.get("/login", (req, res) => {
    const state = randomUUID();
    req.session.oauthState = state;
    res.redirect(oidcClient.getAuthorizationUrl(state));
  });

  router.get("/callback", async (req, res) => {
    const { code, state } = req.query;

    if (
      typeof state !== "string" ||
      typeof code !== "string" ||
      !req.session.oauthState ||
      state !== req.session.oauthState
    ) {
      res.status(400).json({ error: "invalid or expired login attempt" });
      return;
    }

    delete req.session.oauthState;

    try {
      const identity = await oidcClient.exchangeCodeForTokens(code);
      req.session.hrbpId = identity.hrbpId;
      res.redirect("/dashboard");
    } catch {
      res.status(401).json({ error: "authentication failed" });
    }
  });

  return router;
}
