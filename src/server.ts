import { loadKnoxConfig, loadSessionSecret } from "./config.js";
import { KnoxOidcClient } from "./auth/knoxOidcClient.js";
import { buildApp } from "./app.js";
import { InMemoryTeamMappingStore } from "./teams/teamMappingStore.js";
import { loadTeamMappings } from "./teams/loadTeamMappings.js";

// Swapping InMemoryTeamMappingStore for a real on-prem-backed store is a
// separate, later concern — this ticket establishes the interface
// (TeamMappingStore) and a file-backed way to maintain it in the meantime.
const mappings = loadTeamMappings(process.env.TEAM_MAPPINGS_PATH);

const port = Number(process.env.PORT ?? 3000);

const app = buildApp({
  oidcClient: new KnoxOidcClient(loadKnoxConfig()),
  teamMappingStore: new InMemoryTeamMappingStore(mappings),
  sessionSecret: loadSessionSecret(),
  devLoginEnabled: process.env.DEV_LOGIN_ENABLED === "true",
});

app.listen(port, () => {
  console.log(`Idea Generator listening on port ${port}`);
});
