import { join } from "node:path";
import {
  loadIdeaGenerationLlmConfig,
  loadKnoxConfig,
  loadLlmConfig,
  loadSessionSecret,
  loadStorageConfig,
} from "./config.js";
import { KnoxOidcClient } from "./auth/knoxOidcClient.js";
import { buildApp } from "./app.js";
import { InMemoryTeamMappingStore } from "./teams/teamMappingStore.js";
import { loadTeamMappings } from "./teams/loadTeamMappings.js";
import { EncryptedFileSystemStore } from "./uploads/rawFileStore.js";
import { DerivedDataStore } from "./uploads/derivedDataStore.js";
import { FileAuditLog } from "./uploads/auditLog.js";
import { RequestIntakeStore } from "./requests/requestIntakeStore.js";
import { EnterpriseLlmClient } from "./analysis/enterpriseLlmClient.js";
import { CorpusProposalStore } from "./corpus/corpusProposalStore.js";
import { DEFAULT_CORPUS_PATH, loadCorpus } from "./corpus/loadCorpus.js";
import { OnPremVectorStore } from "./corpus/vectorStore.js";
import { EnterpriseIdeaLlmClient } from "./generation/enterpriseIdeaLlmClient.js";
import { GeneratedIdeasStore } from "./generation/generatedIdeasStore.js";
import { AdoptedIdeaStore } from "./tracking/adoptedIdeaStore.js";

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

const themeLlmClient = new EnterpriseLlmClient(loadLlmConfig());
const analysisDeps = {
  derivedDataStore: ingestDeps.derivedDataStore,
  llmClient: themeLlmClient,
};

const adoptedIdeaStore = new AdoptedIdeaStore(join(storageConfig.baseDir, "adopted-ideas"), storageConfig.encryptionKey);

// Shared with corpusDeps below - ticket 09's approval flow mutates this
// same instance in place (OnPremVectorStore.addEntry), so generation sees
// an approved addition on its very next request with no restart.
const vectorStore = new OnPremVectorStore(loadCorpus());

const generationDeps = {
  requestIntakeStore,
  derivedDataStore: ingestDeps.derivedDataStore,
  generatedIdeasStore: new GeneratedIdeasStore(join(storageConfig.baseDir, "generated-ideas"), storageConfig.encryptionKey),
  vectorStore,
  ideaLlmClient: new EnterpriseIdeaLlmClient(loadIdeaGenerationLlmConfig()),
  themeLlmClient,
  adoptedIdeaStore,
};

const trackingDeps = { adoptedIdeaStore, themeLlmClient };

const corpusDeps = {
  proposalStore: new CorpusProposalStore(join(storageConfig.baseDir, "corpus-proposals"), storageConfig.encryptionKey),
  vectorStore,
  corpusFilePath: DEFAULT_CORPUS_PATH,
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
  generationDeps,
  trackingDeps,
  corpusDeps,
});

app.listen(port, () => {
  console.log(`Idea Generator listening on port ${port}`);
});
