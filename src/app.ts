import express, { type Express } from "express";
import session from "express-session";
import { buildAuthRouter } from "./auth/authRoutes.js";
import type { OidcClient } from "./auth/oidcClient.js";
import { buildTeamsRouter } from "./teams/teamsRoutes.js";
import type { TeamMappingStore } from "./teams/teamMappingStore.js";

export interface AppDeps {
  oidcClient: OidcClient;
  teamMappingStore: TeamMappingStore;
  sessionSecret: string;
}

export function buildApp({ oidcClient, teamMappingStore, sessionSecret }: AppDeps): Express {
  const app = express();

  app.use(
    session({
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: "lax" },
    }),
  );

  app.use("/auth", buildAuthRouter(oidcClient));
  app.use("/api/teams", buildTeamsRouter(teamMappingStore));

  return app;
}
