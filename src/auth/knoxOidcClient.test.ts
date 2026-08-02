import { afterEach, describe, expect, it, vi } from "vitest";
import type { KnoxConfig } from "../config.js";

const testConfig: KnoxConfig = {
  issuer: "https://knox.samsung.internal",
  authorizationEndpoint: "https://knox.samsung.internal/oauth2/authorize",
  tokenEndpoint: "https://knox.samsung.internal/oauth2/token",
  jwksUri: "https://knox.samsung.internal/oauth2/jwks",
  clientId: "idea-generator",
  clientSecret: "test-secret",
  redirectUri: "https://idea-generator.samsung.internal/auth/callback",
};

const fakeJwks = Symbol("fake-jwks");

vi.mock("jose", async () => {
  const actual = await vi.importActual<typeof import("jose")>("jose");
  return {
    ...actual,
    createRemoteJWKSet: vi.fn().mockReturnValue(fakeJwks),
    jwtVerify: vi.fn(),
  };
});

describe("KnoxOidcClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("builds an authorization URL with the required OIDC parameters", async () => {
    const { KnoxOidcClient } = await import("./knoxOidcClient.js");
    const client = new KnoxOidcClient(testConfig);

    const url = new URL(client.getAuthorizationUrl("random-state-value"));

    expect(url.origin + url.pathname).toBe(testConfig.authorizationEndpoint);
    expect(url.searchParams.get("client_id")).toBe(testConfig.clientId);
    expect(url.searchParams.get("redirect_uri")).toBe(testConfig.redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("state")).toBe("random-state-value");
  });

  it("exchanges an authorization code for a verified HRBP identity", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockResolvedValue({
      payload: {
        sub: "hrbp-1",
        email: "hrbp1@samsung.com",
        name: "HRBP One",
      },
      protectedHeader: { alg: "RS256" },
      key: undefined as never,
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: "fake.id.token" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { KnoxOidcClient } = await import("./knoxOidcClient.js");
    const client = new KnoxOidcClient(testConfig);

    const identity = await client.exchangeCodeForTokens("auth-code-123");

    expect(identity).toEqual({
      hrbpId: "hrbp-1",
      email: "hrbp1@samsung.com",
      name: "HRBP One",
    });

    expect(vi.mocked(jwtVerify)).toHaveBeenCalledWith(
      "fake.id.token",
      expect.anything(),
      expect.objectContaining({
        issuer: testConfig.issuer,
        audience: testConfig.clientId,
      }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      testConfig.tokenEndpoint,
      expect.objectContaining({ method: "POST" }),
    );
    const [, requestInit] = fetchMock.mock.calls[0];
    const body = new URLSearchParams(requestInit.body as string);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("auth-code-123");
    expect(body.get("redirect_uri")).toBe(testConfig.redirectUri);
    expect(body.get("client_id")).toBe(testConfig.clientId);
    expect(body.get("client_secret")).toBe(testConfig.clientSecret);
  });

  it("rejects a token that fails signature or issuer verification", async () => {
    const { jwtVerify } = await import("jose");
    vi.mocked(jwtVerify).mockRejectedValue(
      new Error("signature verification failed"),
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id_token: "forged.id.token" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { KnoxOidcClient } = await import("./knoxOidcClient.js");
    const client = new KnoxOidcClient(testConfig);

    await expect(client.exchangeCodeForTokens("some-code")).rejects.toThrow(
      /signature verification failed/,
    );
  });

  it("throws when the token endpoint responds with an error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("invalid_grant"),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { KnoxOidcClient } = await import("./knoxOidcClient.js");
    const client = new KnoxOidcClient(testConfig);

    await expect(client.exchangeCodeForTokens("bad-code")).rejects.toThrow(
      /token exchange failed/i,
    );
  });
});
