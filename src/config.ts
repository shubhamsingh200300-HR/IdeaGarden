function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Knox integration is pending confirmation (technical-architecture-spec.md,
 * Section 6.1): this assumes Knox exposes a standard OIDC authorization
 * code flow. If Knox only supports SAML, this config and KnoxOidcClient
 * both need to change.
 */
export interface KnoxConfig {
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  jwksUri: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function loadKnoxConfig(): KnoxConfig {
  return {
    issuer: requireEnv("KNOX_ISSUER"),
    authorizationEndpoint: requireEnv("KNOX_AUTHORIZATION_ENDPOINT"),
    tokenEndpoint: requireEnv("KNOX_TOKEN_ENDPOINT"),
    jwksUri: requireEnv("KNOX_JWKS_URI"),
    clientId: requireEnv("KNOX_CLIENT_ID"),
    clientSecret: requireEnv("KNOX_CLIENT_SECRET"),
    redirectUri: requireEnv("KNOX_REDIRECT_URI"),
  };
}

export function loadSessionSecret(): string {
  return requireEnv("SESSION_SECRET");
}

export interface StorageConfig {
  baseDir: string;
  encryptionKey: Buffer;
}

/** STORAGE_ENCRYPTION_KEY must be a 32-byte key, hex-encoded (64 hex characters), for AES-256-GCM. */
export function loadStorageConfig(): StorageConfig {
  const keyHex = requireEnv("STORAGE_ENCRYPTION_KEY");
  const encryptionKey = Buffer.from(keyHex, "hex");
  if (encryptionKey.length !== 32) {
    throw new Error("STORAGE_ENCRYPTION_KEY must be a 32-byte key, hex-encoded (64 hex characters)");
  }
  return { baseDir: process.env.STORAGE_DIR ?? "./data", encryptionKey };
}

/**
 * LLM strategy is anonymize-on-prem-then-call-cloud-LLM (technical-
 * architecture-spec.md Section 2): Claude Enterprise or Gemini Enterprise.
 * The exact Enterprise endpoint shape/auth mechanism is not confirmed -
 * this assumes a simple bearer-token JSON API. Verify against whichever
 * provider is actually approved before relying on this in production.
 */
export interface LlmConfig {
  endpoint: string;
  apiKey: string;
  model: string;
}

export function loadLlmConfig(): LlmConfig {
  return {
    endpoint: requireEnv("LLM_ENDPOINT"),
    apiKey: requireEnv("LLM_API_KEY"),
    model: requireEnv("LLM_MODEL"),
  };
}
