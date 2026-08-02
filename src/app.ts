import express, { type Express } from "express";
import session from "express-session";
import { buildAuthRouter } from "./auth/authRoutes.js";
import { buildDevAuthRouter } from "./auth/devAuthRoutes.js";
import type { OidcClient } from "./auth/oidcClient.js";
import { buildTeamsRouter } from "./teams/teamsRoutes.js";
import type { TeamMappingStore } from "./teams/teamMappingStore.js";
import { buildPagesRouter } from "./pages/pagesRoutes.js";
import { buildUploadRoutes } from "./uploads/uploadRoutes.js";
import type { IngestDeps } from "./uploads/ingestUpload.js";
import { buildRequestRoutes } from "./requests/requestRoutes.js";
import { buildManagerRoutes } from "./requests/managerRoutes.js";
import type { RequestIntakeStore } from "./requests/requestIntakeStore.js";
import { buildAnalysisRoutes, type AnalysisDeps } from "./analysis/analysisRoutes.js";
import { buildGenerationRoutes } from "./generation/generationRoutes.js";
import { buildIdeaPagesRoutes } from "./generation/ideaPagesRoutes.js";
import type { RunGenerationDeps } from "./generation/runGeneration.js";

export interface AppDeps {
  oidcClient: OidcClient;
  teamMappingStore: TeamMappingStore;
  sessionSecret: string;
  /**
   * Local-testing-only: log in as any email with no verification, no Knox
   * involved. Must default to false/unset everywhere except a developer's
   * own machine — never enable this in a real deployment.
   */
  devLoginEnabled?: boolean;
  /** Omit to run without upload endpoints mounted (e.g. tests that don't need them). */
  ingestDeps?: IngestDeps;
  /** Omit to run without request-intake endpoints mounted (e.g. tests that don't need them). */
  requestIntakeStore?: RequestIntakeStore;
  /** Omit to use RequestIntakeStore's own default manager-invite expiry (7 days). */
  managerInviteExpiryMs?: number;
  /** Omit to run without the signal-analysis endpoint mounted (e.g. tests that don't need it). */
  analysisDeps?: AnalysisDeps;
  /** Omit to run without the idea-generation endpoints mounted (e.g. tests that don't need them). */
  generationDeps?: RunGenerationDeps;
}

export function buildApp({
  oidcClient,
  teamMappingStore,
  sessionSecret,
  devLoginEnabled = false,
  ingestDeps,
  requestIntakeStore,
  managerInviteExpiryMs,
  analysisDeps,
  generationDeps,
}: AppDeps): Express {
  const app = express();

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax" },
    }),
  );
  app.use(express.urlencoded({ extended: false }));

  app.use("/auth", buildAuthRouter(oidcClient));
  if (devLoginEnabled) {
    app.use("/auth", buildDevAuthRouter());
  }
  app.use("/api/teams", buildTeamsRouter(teamMappingStore));
  if (ingestDeps) {
    app.use("/api/teams", buildUploadRoutes(ingestDeps, teamMappingStore));
  }
  if (requestIntakeStore) {
    app.use("/api/teams", buildRequestRoutes(requestIntakeStore, teamMappingStore, managerInviteExpiryMs));
    app.use("/manager/requests", buildManagerRoutes(requestIntakeStore));
  }
  if (analysisDeps) {
    app.use("/api/teams", buildAnalysisRoutes(analysisDeps, teamMappingStore));
  }
  if (generationDeps) {
    app.use("/api/teams", buildGenerationRoutes(generationDeps, teamMappingStore));
    app.use("/dashboard", buildIdeaPagesRoutes(generationDeps, teamMappingStore));
  }
  app.use("/", buildPagesRouter(teamMappingStore, devLoginEnabled));

  return app;
}
