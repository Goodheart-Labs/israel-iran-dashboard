import { ConvexError } from "convex/values";

const ACCESS_ERROR = "Enter the AI risk page password again to continue.";
const encoder = new TextEncoder();

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

/**
 * Only the password endpoint can issue this bearer token. The password itself
 * never reaches Convex or the browser bundle. The signature covers the exact
 * base64url payload segment, using the UTF-8 bytes of the shared server secret.
 */
export async function verifyAiRiskAccessToken(
  accessToken: string,
  secret: string | undefined,
  nowSeconds: number,
): Promise<boolean> {
  if (!secret || encoder.encode(secret).length < 32 || accessToken.length > 1024) return false;
  const parts = accessToken.split(".");
  if (
    parts.length !== 2 ||
    !/^[A-Za-z0-9_-]+$/.test(parts[0]) ||
    !/^[A-Za-z0-9_-]{43}$/.test(parts[1])
  ) return false;

  try {
    const signature = decodeBase64Url(parts[1]);
    if (signature.byteLength !== 32) return false;
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const validSignature = await crypto.subtle.verify(
      "HMAC", key, signature, encoder.encode(parts[0]),
    );
    if (!validSignature) return false;
    const payload: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeBase64Url(parts[0])));
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return false;
    const claims = payload as Record<string, unknown>;
    return claims.scope === "ai-risk" &&
      typeof claims.exp === "number" &&
      Number.isSafeInteger(claims.exp) &&
      claims.exp > nowSeconds;
  } catch {
    return false;
  }
}

/** Fail closed before any query or mutation touches the AI risk tables. */
export async function requireAiRiskAccess(accessToken: string): Promise<void> {
  const authorized = await verifyAiRiskAccessToken(
    accessToken,
    process.env.AI_RISK_SESSION_SECRET,
    Math.floor(Date.now() / 1000),
  );
  if (!authorized) throw new ConvexError(ACCESS_ERROR);
}
