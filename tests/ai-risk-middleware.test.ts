import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import middleware from "../middleware";
import { requireAiRiskAccess, verifyAiRiskAccessToken } from "../convex/aiRiskAccess";
import { AI_RISK_COOKIE, SESSION_SECONDS, createSession, verifySession } from "../server/aiRiskSession";

const ORIGIN = "https://globalriskodds.com";
const SECRET = "middleware-tests-use-a-fixture-secret-not-a-live-key";
const PASSWORD = "fixtureword";
const NOW = 1_800_000_000;

function fixture(t: TestContext) {
  const previousSecret = process.env.AI_RISK_SESSION_SECRET;
  const previousPassword = process.env.AI_RISK_PASSWORD;
  process.env.AI_RISK_SESSION_SECRET = SECRET;
  process.env.AI_RISK_PASSWORD = PASSWORD;
  t.mock.method(Date, "now", () => NOW * 1000);
  t.after(() => {
    if (previousSecret === undefined) delete process.env.AI_RISK_SESSION_SECRET;
    else process.env.AI_RISK_SESSION_SECRET = previousSecret;
    if (previousPassword === undefined) delete process.env.AI_RISK_PASSWORD;
    else process.env.AI_RISK_PASSWORD = previousPassword;
  });
}

function request(path: string, init?: RequestInit): Request {
  return new Request(`${ORIGIN}${path}`, init);
}

function login(password: string, headers: Record<string, string> = {}) {
  return middleware(request("/ai-risk-access", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", origin: ORIGIN, ...headers },
    body: new URLSearchParams({ password }).toString(),
  }));
}

function assertPrivate(response: Response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("vary"), "Cookie");
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/);
}

await test("unauthenticated chart pages, portraits, chart bundles and session data remain private", async (t) => {
  fixture(t);
  for (const path of ["/ai-risk", "/ai-risk/", "/ai-risk/portraits/example.jpg"]) {
    const response = await middleware(request(path));
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), "/ai-risk-access");
    assert.equal(response.headers.get("x-middleware-next"), null);
    assertPrivate(response);
  }
  for (const path of ["/assets/ai-risk-chart123.js", "/assets/ai-risk-style.css"]) {
    const response = await middleware(request(path));
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("x-middleware-next"), null);
    assertPrivate(response);
  }
  const session = await middleware(request("/ai-risk-session"));
  assert.equal(session.status, 401);
  assert.deepEqual(await session.json(), { error: "Password required" });
  assertPrivate(session);
});

await test("the password form contains neither a password nor an access token", async (t) => {
  fixture(t);
  const response = await middleware(request("/ai-risk-access"));
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /type="password"/);
  assert.match(html, /action="\/ai-risk-access"/);
  assert.ok(!html.includes(PASSWORD) && !html.includes(SECRET));
  assert.equal(response.headers.get("set-cookie"), null);
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assertPrivate(response);
});

await test("a correct password sets a secure host-only session accepted by both middleware and Convex", async (t) => {
  fixture(t);
  const denied = await login("incorrect");
  assert.equal(denied.status, 401);
  assert.equal(denied.headers.get("set-cookie"), null);
  assertPrivate(denied);

  const accepted = await login(PASSWORD);
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get("location"), "/ai-risk");
  const setCookie = accepted.headers.get("set-cookie") ?? "";
  assert.match(setCookie, new RegExp(`^${AI_RISK_COOKIE}=`));
  assert.match(setCookie, /; Path=\/; HttpOnly; Secure; SameSite=Lax;/);
  assert.match(setCookie, new RegExp(`Max-Age=${SESSION_SECONDS}$`));
  assert.ok(!setCookie.includes("Domain=") && !setCookie.includes(PASSWORD) && !setCookie.includes(SECRET));
  const cookie = setCookie.split(";")[0];
  const token = cookie.slice(AI_RISK_COOKIE.length + 1);
  await assert.doesNotReject(requireAiRiskAccess(token));
  assert.equal(await verifySession(token, SECRET, NOW), true);
  assert.equal(await verifyAiRiskAccessToken(token, SECRET, NOW), true);

  for (const path of ["/ai-risk", "/assets/ai-risk-chart123.js", "/ai-risk/portraits/example.jpg"]) {
    const response = await middleware(request(path, { headers: { cookie } }));
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assertPrivate(response);
  }
  const session = await middleware(request("/ai-risk-session", { headers: { cookie } }));
  assert.equal(session.status, 200);
  assert.deepEqual(await session.json(), { accessToken: token });
  assertPrivate(session);
  const form = await middleware(request("/ai-risk-access", { headers: { cookie } }));
  assert.equal(form.status, 303);
  assert.equal(form.headers.get("location"), "/ai-risk");
});

await test("tampered, expired and incorrectly named cookies cannot unlock protected content", async (t) => {
  fixture(t);
  const valid = await createSession(SECRET, NOW);
  const expired = await createSession(SECRET, NOW - SESSION_SECONDS);
  const [payload, signature] = valid.split(".");
  const tampered = `${payload}.${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
  for (const cookie of [
    `${AI_RISK_COOKIE}=${tampered}`,
    `${AI_RISK_COOKIE}=${expired}`,
    `${AI_RISK_COOKIE}=invalid`,
    `fake-${AI_RISK_COOKIE}=${valid}`,
  ]) {
    assert.equal((await middleware(request("/ai-risk-session", { headers: { cookie } }))).status, 401);
    assert.equal((await middleware(request("/assets/ai-risk-chart.js", { headers: { cookie } }))).status, 401);
  }
});

await test("cross-origin login and logout requests cannot create or remove a session", async (t) => {
  fixture(t);
  for (const origin of ["https://other.example", "null", "https://globalriskodds.com.other.example"]) {
    const response = await login(PASSWORD, { origin });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("set-cookie"), null);
    const logout = await middleware(request("/ai-risk-session", { method: "DELETE", headers: { origin } }));
    assert.equal(logout.status, 403);
    assert.equal(logout.headers.get("set-cookie"), null);
  }
  const logout = await middleware(request("/ai-risk-session", { method: "DELETE", headers: { origin: ORIGIN } }));
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie") ?? "", /Max-Age=0$/);
  assertPrivate(logout);
});

await test("unsupported login methods, body formats and oversized requests are rejected", async (t) => {
  fixture(t);
  assert.equal((await middleware(request("/ai-risk-access", { method: "PUT" }))).status, 405);
  assert.equal((await middleware(request("/ai-risk-session", { method: "POST" }))).status, 405);
  assert.equal((await middleware(request("/ai-risk-access", {
    method: "POST", headers: { "content-type": "application/json", origin: ORIGIN }, body: JSON.stringify({ password: PASSWORD }),
  }))).status, 415);
  assert.equal((await login(PASSWORD, { "content-length": "2049" })).status, 413);
  assert.equal((await login("a".repeat(2049))).status, 413);
  assert.equal((await login("a".repeat(129))).status, 401);
});

await test("missing server configuration fails closed while leaving the public site accessible", async (t) => {
  fixture(t);
  for (const missing of ["AI_RISK_PASSWORD", "AI_RISK_SESSION_SECRET"] as const) {
    const before = process.env[missing];
    delete process.env[missing];
    for (const path of ["/ai-risk", "/ai-risk-access", "/ai-risk-session", "/assets/ai-risk-data.js"]) {
      const response = await middleware(request(path));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("x-middleware-next"), null);
      assertPrivate(response);
      assert.ok(!(await response.text()).includes('type="password"'));
    }
    assert.equal((await middleware(request("/"))).headers.get("x-middleware-next"), "1");
    process.env[missing] = before;
  }
});

await test("public pages and unrelated assets pass through without private-page cache headers", async (t) => {
  fixture(t);
  for (const path of ["/", "/agi", "/ipo", "/assets/index-public.js", "/assets/styles.css", "/favicon.svg"]) {
    const response = await middleware(request(path));
    assert.equal(response.headers.get("x-middleware-next"), "1");
    assert.equal(response.headers.get("cache-control"), null);
    assert.equal(response.headers.get("x-robots-tag"), null);
  }
});

await test("encoded paths cannot bypass the protected page or asset gate", async (t) => {
  fixture(t);
  for (const path of [
    "/ai%2Drisk", "/%61i-risk", "/ai-risk%2Fportraits%2Fexample.jpg",
    "/assets/ai%2Drisk-chart.js", "/assets/%61i-risk-chart.js", "/assets%2Fai-risk-chart.js",
    "/assets/foo%3F%2F..%2Fai-risk-private.js", "/assets/foo%23%2F..%2Fai-risk-private.js",
    "/assets%252Fai-risk-chart.js", "/ai-risk%5Cportraits%5Cexample.jpg",
  ]) {
    const response = await middleware(request(path));
    assert.equal(response.headers.get("x-middleware-next"), null, `${path} must be denied`);
    assert.ok([303, 400, 401].includes(response.status), `${path} must not serve protected content`);
  }
});
