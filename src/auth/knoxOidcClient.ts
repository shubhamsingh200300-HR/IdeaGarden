import { createRemoteJWKSet, jwtVerify } from "jose";
import type { KnoxConfig } from "../config.js";
import type { AuthenticatedHrbp, OidcClient } from "./oidcClient.js";

const REQUIRED_SCOPE = "openid profile email";

/**
 * Talks to Samsung Knox via a standard OIDC authorization code flow.
 * Pending confirmation (technical-architecture-spec.md, Section 6.1) that
 * Knox actually exposes this — if it only supports SAML, this class is the
 * one to replace.
 */
export class KnoxOidcClient implements OidcClient {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(private readonly config: KnoxConfig) {
    this.jwks = createRemoteJWKSet(new URL(config.jwksUri));
  }

  getAuthorizationUrl(state: string): string {
    const url = new URL(this.config.authorizationEndpoint);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", REQUIRED_SCOPE);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async exchangeCodeForTokens(code: string): Promise<AuthenticatedHrbp> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const response = await fetch(this.config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Knox token exchange failed (${response.status}): ${detail}`);
    }

    const { id_token: idToken } = (await response.json()) as { id_token: string };
    const { payload } = await jwtVerify(idToken, this.jwks, {
      issuer: this.config.issuer,
      audience: this.config.clientId,
    });

    if (typeof payload.sub !== "string") {
      throw new Error("Knox ID token is missing a 'sub' claim");
    }

    return {
      hrbpId: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  }
}
