import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { verifyAiRiskAccessToken } from "../convex/aiRiskAccess";

const SECRET = "ai-risk-access-tests-use-an-independent-node-hmac";
const NOW = 1_800_000_000;
const claims = { scope: "ai-risk", exp: NOW + 7 * 24 * 60 * 60 };

function sign(payload: unknown, secret = SECRET): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
}

await test("a server-issued HMAC token is accepted up to, but not at, its expiration second", async () => {
  const token = sign(claims);
  assert.equal(await verifyAiRiskAccessToken(token, SECRET, NOW), true);
  assert.equal(await verifyAiRiskAccessToken(token, SECRET, claims.exp - 1), true);
  assert.equal(await verifyAiRiskAccessToken(token, SECRET, claims.exp), false);
  assert.equal(await verifyAiRiskAccessToken(token, SECRET, claims.exp + 1), false);
});

await test("missing or undersized configuration fails closed, and another secret cannot authenticate", async () => {
  const token = sign(claims);
  for (const secret of [undefined, "", "x".repeat(31), "other-secret-with-at-least-thirty-two-characters"]) {
    assert.equal(await verifyAiRiskAccessToken(token, secret, NOW), false);
  }
});

await test("a modified payload or signature is rejected", async () => {
  const [payload, signature] = sign(claims).split(".");
  const replacement = Buffer.from(JSON.stringify({ ...claims, exp: claims.exp + 1 })).toString("base64url");
  assert.equal(await verifyAiRiskAccessToken(`${replacement}.${signature}`, SECRET, NOW), false);
  const damagedSignature = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;
  assert.equal(await verifyAiRiskAccessToken(`${payload}.${damagedSignature}`, SECRET, NOW), false);
});

await test("even valid signatures cannot authorize another scope or malformed expiration claims", async () => {
  for (const payload of [
    null, [], "ai-risk", {},
    { ...claims, scope: "admin" },
    { scope: "ai-risk" },
    { ...claims, exp: String(claims.exp) },
    { ...claims, exp: claims.exp + 0.5 },
    { ...claims, exp: Number.MAX_SAFE_INTEGER + 1 },
    { ...claims, exp: NOW - 1 },
  ]) {
    assert.equal(await verifyAiRiskAccessToken(sign(payload), SECRET, NOW), false);
  }
});

await test("malformed, oversized, and non-base64url tokens fail without throwing", async () => {
  const [payload, signature] = sign(claims).split(".");
  const malformedJson = Buffer.from("{not json}").toString("base64url");
  const malformedJsonSignature = createHmac("sha256", SECRET).update(malformedJson).digest("base64url");
  for (const token of [
    "", ".", sign(claims) + ".extra", "x".repeat(1025),
    `${payload}.${signature}=`, `${payload}.${signature.slice(1)}`, `${payload}.!${signature.slice(1)}`,
    `${payload}=.${signature}`, `.${signature}`, `${payload}.`,
    `${malformedJson}.${malformedJsonSignature}`,
  ]) {
    assert.equal(await verifyAiRiskAccessToken(token, SECRET, NOW), false);
  }
});
