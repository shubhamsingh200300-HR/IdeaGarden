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
}

export function buildApp({
  oidcClient,
  teamMappingStore,
  sessionSecret,
  devLoginEnabled = false,
  ingestDeps,
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
  app.use("/", buildPagesRouter(teamMappingStore, devLoginEnabled));

  return app;
}
