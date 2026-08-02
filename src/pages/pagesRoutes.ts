import { Router } from "express";
import { requireAuthPage } from "../auth/authMiddleware.js";
import type { TeamMappingStore } from "../teams/teamMappingStore.js";
import { escapeHtml, layout } from "./html.js";

export function buildPagesRouter(teamMappingStore: TeamMappingStore): Router {
  const router = Router();

  router.get("/", (req, res) => {
    if (req.session.hrbpId) {
      res.redirect("/dashboard");
      return;
    }
    res.send(
      layout(
        "Idea Generator",
        `<h1>Employee Engagement Idea Generator</h1>
<p><a href="/auth/login">Log in with Samsung Knox</a></p>`,
      ),
    );
  });

  router.get("/dashboard", requireAuthPage, (req, res) => {
    const teams = teamMappingStore.getTeamsForHrbp(req.session.hrbpId!);
    const teamsList =
      teams.length === 0
        ? "<p>You have no teams assigned yet.</p>"
        : `<ul>${teams
            .map((team) => `<li>${escapeHtml(team.teamName)}</li>`)
            .join("")}</ul>`;

    res.send(layout("Dashboard", `<h1>Your teams</h1>${teamsList}`));
  });

  return router;
}
