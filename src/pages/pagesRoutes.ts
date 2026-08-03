import { Router } from "express";
import { requireAuthPage } from "../auth/authMiddleware.js";
import type { TeamMappingStore } from "../teams/teamMappingStore.js";
import { escapeHtml, layout, pageHeader } from "./html.js";

export function buildPagesRouter(
  teamMappingStore: TeamMappingStore,
  devLoginEnabled = false,
): Router {
  const router = Router();

  router.get("/", (req, res) => {
    if (req.session.hrbpId) {
      res.redirect("/dashboard");
      return;
    }

    const devLoginLink = devLoginEnabled
      ? `<p class="field-hint"><a href="/auth/dev-login">Dev login (local testing only)</a></p>`
      : "";

    res.send(
      layout(
        "Idea Garden",
        `<div class="landing stack">
  ${pageHeader(
    "Employee Engagement Idea Generator",
    "Engagement initiatives, grounded in evidence.",
    "Upload your team's culture survey. Idea Garden diagnoses the real signals and proposes structural initiatives modeled on Netflix, Atlassian, Google, and eleven other proven engineering cultures — never another team outing.",
  )}
  <a class="btn" href="/auth/login">Log in with Samsung Knox</a>
  ${devLoginLink}
</div>`,
        { centered: true },
      ),
    );
  });

  router.get("/dashboard", requireAuthPage, (req, res) => {
    const hrbpId = req.session.hrbpId!;
    const teams = teamMappingStore.getTeamsForHrbp(hrbpId);

    const teamsList =
      teams.length === 0
        ? `<p class="empty-state">You have no teams assigned yet. Once a team is mapped to you, it will appear here.</p>`
        : `<ul class="team-list">${teams
            .map(
              (team) =>
                `<li><a class="team-row" href="/dashboard/teams/${escapeHtml(team.teamId)}/ideas">
                  <div class="card card--quiet">
                    <span class="team-name">${escapeHtml(team.teamName)}</span>
                    <span class="arrow" aria-hidden="true">&rarr;</span>
                  </div>
                </a></li>`,
            )
            .join("")}</ul>`;

    res.send(
      layout("Dashboard", `${pageHeader("Your teams", "Dashboard")}${teamsList}`, {
        headerMeta: escapeHtml(hrbpId),
      }),
    );
  });

  return router;
}
