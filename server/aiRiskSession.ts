export const AI_RISK_COOKIE = "__Host-ai-risk-access";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeBase64url(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Invalid encoding");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function key(secret: string) {
  if (secret.length < 32) throw new Error("AI risk access is not configured");
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function createSession(secret: string, now = Math.floor(Date.now() / 1000)): Promise<string> {
  const payload = base64url(encoder.encode(JSON.stringify({ scope: "ai-risk", exp: now + SESSION_SECONDS })));
  const signature = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload));
  return `${payload}.${base64url(new Uint8Array(signature))}`;
}

export async function verifySession(token: string | undefined, secret: string, now = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!token || token.length > 1024 || secret.length < 32) return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const bytes = decodeBase64url(signature);
    if (bytes.length !== 32) return false;
    const valid = await crypto.subtle.verify("HMAC", await key(secret), bytes, encoder.encode(payload));
    if (!valid) return false;
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64url(payload))) as { scope?: unknown; exp?: unknown };
    return parsed.scope === "ai-risk" && typeof parsed.exp === "number" && Number.isSafeInteger(parsed.exp) && parsed.exp > now;
  } catch { return false; }
}

export function cookieToken(request: Request): string | undefined {
  return request.headers.get("cookie")?.split(";").map(part => part.trim()).find(part => part.startsWith(`${AI_RISK_COOKIE}=`))?.slice(AI_RISK_COOKIE.length + 1);
}

export function sessionCookie(token: string, maxAge = SESSION_SECONDS): string {
  return `${AI_RISK_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function passwordMatches(input: string, expected: string): Promise<boolean> {
  if (!expected || input.length > 128) return false;
  const [a, b] = await Promise.all([crypto.subtle.digest("SHA-256", encoder.encode(input)), crypto.subtle.digest("SHA-256", encoder.encode(expected))]);
  const first = new Uint8Array(a);
  const second = new Uint8Array(b);
  let different = 0;
  for (let i = 0; i < first.length; i++) different |= first[i] ^ second[i];
  return different === 0;
}
