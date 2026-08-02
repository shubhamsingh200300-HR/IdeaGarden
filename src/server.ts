import { join } from "node:path";
import { loadKnoxConfig, loadLlmConfig, loadSessionSecret, loadStorageConfig } from "./config.js";
import { KnoxOidcClient } from "./auth/knoxOidcClient.js";
import { buildApp } from "./app.js";
import { InMemoryTeamMappingStore } from "./teams/teamMappingStore.js";
import { loadTeamMappings } from "./teams/loadTeamMappings.js";
import { EncryptedFileSystemStore } from "./uploads/rawFileStore.js";
import { DerivedDataStore } from "./uploads/derivedDataStore.js";
import { FileAuditLog } from "./uploads/auditLog.js";
import { RequestIntakeStore } from "./requests/requestIntakeStore.js";
import { EnterpriseLlmClient } from "./analysis/enterpriseLlmClient.js";

// Swapping InMemoryTeamMappingStore for a real on-prem-backed store is a
// separate, later concern — this ticket establishes the interface
// (TeamMappingStore) and a file-backed way to maintain it in the meantime.
const mappings = loadTeamMappings(process.env.TEAM_MAPPINGS_PATH);

const storageConfig = loadStorageConfig();
const ingestDeps = {
  rawFileStore: new EncryptedFileSystemStore(join(storageConfig.baseDir, "raw"), storageConfig.encryptionKey),
  derivedDataStore: new DerivedDataStore(join(storageConfig.baseDir, "derived"), storageConfig.encryptionKey),
  auditLog: new FileAuditLog(join(storageConfig.baseDir, "audit.log")),
};

const requestIntakeStore = new RequestIntakeStore(
  join(storageConfig.baseDir, "requests"),
  storageConfig.encryptionKey,
);

const analysisDeps = {
  derivedDataStore: ingestDeps.derivedDataStore,
  llmClient: new EnterpriseLlmClient(loadLlmConfig()),
};

const port = Number(process.env.PORT ?? 3000);
const managerInviteExpiryMs = process.env.MANAGER_INVITE_EXPIRY_MS
  ? Number(process.env.MANAGER_INVITE_EXPIRY_MS)
  : undefined;

const app = buildApp({
  oidcClient: new KnoxOidcClient(loadKnoxConfig()),
  teamMappingStore: new InMemoryTeamMappingStore(mappings),
  sessionSecret: loadSessionSecret(),
  devLoginEnabled: process.env.DEV_LOGIN_ENABLED === "true",
  ingestDeps,
  requestIntakeStore,
  managerInviteExpiryMs,
  analysisDeps,
});

app.listen(port, () => {
  console.log(`Idea Generator listening on port ${port}`);
});
