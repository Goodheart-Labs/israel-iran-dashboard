import { cookieToken, createSession, passwordMatches, sessionCookie, verifySession } from "./server/aiRiskSession.js";

export const config = {
  runtime: "nodejs",
  // Include encoded aliases as well as the canonical paths. Public paths pass through.
  matcher: "/:path*",
};

const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie",
};

function passwordPage(error = false, unavailable = false): Response {
  const message = unavailable ? "Access is being set up. Please try again shortly." : error ? "That password didn’t match. Try again." : "Enter the password to explore the AI risk page.";
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>AI risk · Global Risk Odds</title><style>
    *{box-sizing:border-box}body{margin:0;background:#f5f1e8;color:#193e32;font-family:Arial,sans-serif;min-height:100svh;display:grid;place-items:center;padding:24px}main{width:100%;max-width:410px}header{font-size:11px;letter-spacing:.12em;font-weight:700;margin-bottom:48px}h1{font-family:Georgia,serif;font-size:44px;font-weight:400;letter-spacing:-.04em;margin:0 0 18px}p{font-size:14px;line-height:1.6;color:#62766b;margin:0 0 24px}label{display:block;font-size:12px;margin-bottom:9px}input{display:block;width:100%;border:1px solid #b9c8ae;background:#fffdf7;color:#193e32;border-radius:5px;font-size:18px;padding:13px;margin-bottom:14px}button{display:flex;justify-content:space-between;width:100%;background:#193e32;color:#f5f1e8;border:0;border-radius:5px;padding:14px 16px;font-size:14px;cursor:pointer}input:focus-visible,button:focus-visible,a:focus-visible{outline:3px solid #bd783c;outline-offset:3px}a{display:inline-block;color:#62766b;font-size:12px;margin-top:28px;text-underline-offset:3px}.error{color:#a43826}
  </style></head><body><main><header>GLOBAL RISK ODDS</header><h1>The AI risk explorer.</h1><p${error ? ' class="error" role="alert"' : ""}>${message}</p>${unavailable ? "" : '<form method="post" action="/ai-risk-access"><label for="password">Password</label><input id="password" name="password" type="password" required maxlength="128" autocomplete="current-password" autofocus><button type="submit">Open the explorer <span aria-hidden="true">↗</span></button></form>'}<a href="/">← Back to Global Risk Odds</a></main></body></html>`, {
    status: unavailable ? 503 : error ? 401 : 200,
    headers: { ...privateHeaders, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" },
  });
}

function continueRequest(protectedPath: boolean): Response {
  // Vercel's next() helper uses this wire header; no runtime dependency needed.
  // https://github.com/vercel/vercel/blob/main/packages/functions/src/middleware.ts
  return new Response(null, { headers: { ...(protectedPath ? privateHeaders : {}), "x-middleware-next": "1" } });
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let path = url.pathname;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const decoded = decodeURIComponent(path);
      if (decoded === path) break;
      path = decoded;
    }
    if (/%[0-9a-f]{2}/i.test(path) || [...path].some(character => character.charCodeAt(0) < 32)) throw new Error("Invalid path");
    const normalized = new URL("https://path.invalid");
    normalized.pathname = `/${path.replace(/\\/g, "/").replace(/^\/+/, "")}`;
    path = normalized.pathname;
  } catch { return new Response("Invalid path", { status: 400, headers: privateHeaders }); }
  const page = path === "/ai-risk" || path.startsWith("/ai-risk/");
  const asset = path.startsWith("/assets/ai-risk-");
  const access = path === "/ai-risk-access";
  const session = path === "/ai-risk-session";
  if (!page && !asset && !access && !session) return continueRequest(false);

  const secret = process.env.AI_RISK_SESSION_SECRET ?? "";
  const password = process.env.AI_RISK_PASSWORD ?? "";
  if (secret.length < 32 || !password) return passwordPage(false, true);

  const token = cookieToken(request);
  const authorized = await verifySession(token, secret);
  if (access) {
    if (request.method === "GET" || request.method === "HEAD") {
      return authorized ? new Response(null, { status: 303, headers: { ...privateHeaders, Location: "/ai-risk" } }) : passwordPage();
    }
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { ...privateHeaders, Allow: "GET, POST" } });
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return new Response("Invalid origin", { status: 403, headers: privateHeaders });
    if (Number(request.headers.get("content-length") ?? 0) > 2048) return new Response("Request too large", { status: 413, headers: privateHeaders });
    if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return new Response("Unsupported request", { status: 415, headers: privateHeaders });
    const body = await request.text();
    if (body.length > 2048) return new Response("Request too large", { status: 413, headers: privateHeaders });
    const supplied = new URLSearchParams(body).get("password") ?? "";
    if (!await passwordMatches(supplied, password)) return passwordPage(true);
    const issued = await createSession(secret);
    return new Response(null, { status: 303, headers: { ...privateHeaders, Location: "/ai-risk", "Set-Cookie": sessionCookie(issued) } });
  }

  if (session) {
    if (request.method === "DELETE") {
      const origin = request.headers.get("origin");
      if (origin && origin !== url.origin) return new Response("Invalid origin", { status: 403, headers: privateHeaders });
      return new Response(null, { status: 204, headers: { ...privateHeaders, "Set-Cookie": sessionCookie("", 0) } });
    }
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405, headers: { ...privateHeaders, Allow: "GET, DELETE" } });
    return Response.json(authorized ? { accessToken: token } : { error: "Password required" }, { status: authorized ? 200 : 401, headers: privateHeaders });
  }
  if (!authorized) {
    return asset ? new Response("Password required", { status: 401, headers: privateHeaders }) : new Response(null, { status: 303, headers: { ...privateHeaders, Location: "/ai-risk-access" } });
  }
  return continueRequest(true);
}
