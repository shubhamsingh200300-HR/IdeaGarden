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
