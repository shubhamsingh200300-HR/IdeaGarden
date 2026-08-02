export interface AuthenticatedHrbp {
  hrbpId: string;
  email?: string;
  name?: string;
}

export interface OidcClient {
  getAuthorizationUrl(state: string): string;
  exchangeCodeForTokens(code: string): Promise<AuthenticatedHrbp>;
}
