export const rpName = process.env.WEBAUTHN_RP_NAME || "MeTalk";
export const rpID = process.env.WEBAUTHN_RP_ID || "localhost";

export const expectedOrigins = (
  process.env.WEBAUTHN_ORIGIN || "http://localhost:3000"
)
  .split(",")
  .map((o) => o.trim());

export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const LOGIN_TOKEN_TTL_MS = 30 * 1000;
export const MAX_PASSKEYS_PER_ACCOUNT = 20;

export function buildSetCookieHeader(
  name: string,
  value: string,
  maxAge: number,
): string {
  const isProduction = process.env.NODE_ENV === "production";
  return [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    isProduction ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function parseCookie(
  cookieHeader: string,
  name: string,
): string | undefined {
  const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
  return match?.[1];
}
