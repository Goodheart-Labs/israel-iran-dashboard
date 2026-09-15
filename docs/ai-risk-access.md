# AI risk page access

The `/ai-risk` explorer is protected separately from the public dashboard.
Vercel Routing Middleware serves a small password form at `/ai-risk-access`.
Successful login sets a Secure, HttpOnly, host-only, SameSite=Lax cookie for
seven days. Passwords and signing secrets are server environment variables,
not Vite variables or client-side constants.

## Configuration

- Vercel Production: `AI_RISK_PASSWORD` and `AI_RISK_SESSION_SECRET` (sensitive).
- Convex Production: the same `AI_RISK_SESSION_SECRET`.
- Local `.env.local`: `AI_RISK_PASSWORD` and a separate development signing
  secret, matching `AI_RISK_SESSION_SECRET` in the development Convex backend.
- Signing secrets must be at least 32 bytes. Rotate both production secrets
  and redeploy Vercel when revoking all sessions or changing the shared word.

The middleware validates normalized paths, including encoded aliases, before
allowing the page, its portraits, or `/assets/ai-risk-*` bundles through.
It checks access before cached responses and gives protected responses
`Cache-Control: private, no-store` and `X-Robots-Tag: noindex`.
Unrelated pages and assets remain public. Chart data must stay in bundles
whose filenames begin `ai-risk-`; verify this when changing code splitting.

The authenticated `/ai-risk-session` endpoint returns the signed token to the
page in a non-cacheable response. All six public `aiRisk` Convex endpoints
validate its HMAC-SHA256 signature, scope and expiration before accessing
the database. The frontend redirects at expiry. The token is kept in route
memory, not localStorage; the separate anonymous voting identifier stays in
localStorage. DELETE `/ai-risk-session` clears the browser's access cookie.
Shared sessions are bearer credentials; clearing one browser's cookie does
not invalidate a token already copied from that authorized browser.

## Local checks

```sh
pnpm --ignore-workspace run build
pnpm --ignore-workspace run lint
pnpm --ignore-workspace exec node --import tsx --test tests/ai-risk-*.test.ts
pnpm --ignore-workspace exec vite preview --host 127.0.0.1 --port 4176
# In another terminal, with the local server secrets configured:
pnpm --ignore-workspace exec node --import tsx scripts/preview_ai_risk_gate.ts
```

The password-gated local preview runs on `http://127.0.0.1:4177/ai-risk`.
Plain Vite does not execute Vercel middleware. Use Chrome for Testing, never
the user's real Chrome application, for browser automation on this machine.

For deployment, the existing production Vercel build also deploys Convex.
`vercel deploy --prod --skip-domain --scope goodheart` builds a production
candidate without changing the live domain. Verify denied and successful
access on the candidate before promoting or allowing the main-branch
production deployment to become current. Test forecasts/votes must be
removed using only the test browser's token after verification.
