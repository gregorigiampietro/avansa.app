import type { MlTokenResponse } from "./types";

const ML_AUTH_BASE_URL = "https://auth.mercadolibre.com";
const ML_API_BASE_URL = "https://api.mercadolibre.com";

function getEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

/**
 * Generate PKCE code_verifier and code_challenge for OAuth 2.0.
 * code_verifier: random 64-char base64url string
 * code_challenge: SHA-256 hash of code_verifier, base64url-encoded
 */
export async function generatePKCE(): Promise<{
  codeVerifier: string;
  codeChallenge: string;
}> {
  const randomBytes = crypto.getRandomValues(new Uint8Array(48));
  const codeVerifier = base64UrlEncode(randomBytes);

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const codeChallenge = base64UrlEncode(new Uint8Array(digest));

  return { codeVerifier, codeChallenge };
}

/**
 * Build the Mercado Livre authorization URL with PKCE challenge.
 */
export function getAuthorizationUrl(codeChallenge: string): string {
  const appId = getEnvVar("ML_APP_ID");
  const redirectUri = getEnvVar("ML_REDIRECT_URI");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: appId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${ML_AUTH_BASE_URL}/authorization?${params.toString()}`;
}

/**
 * Exchange an authorization code for access/refresh tokens.
 */
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string
): Promise<MlTokenResponse> {
  const appId = getEnvVar("ML_APP_ID");
  const clientSecret = getEnvVar("ML_CLIENT_SECRET");
  const redirectUri = getEnvVar("ML_REDIRECT_URI");

  const response = await fetch(`${ML_API_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: appId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to exchange code for token (${response.status}): ${errorBody}`
    );
  }

  const data: MlTokenResponse = await response.json();
  return data;
}

/**
 * Refresh an expired access token using the refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<MlTokenResponse> {
  const appId = getEnvVar("ML_APP_ID");
  const clientSecret = getEnvVar("ML_CLIENT_SECRET");

  const response = await fetch(`${ML_API_BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: appId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to refresh access token (${response.status}): ${errorBody}`
    );
  }

  const data: MlTokenResponse = await response.json();
  return data;
}

// ---- Helpers ----

function base64UrlEncode(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) =>
    String.fromCodePoint(byte)
  ).join("");

  return btoa(binString)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
