# Claude session notes

## AI risk explorer published (2026-09-15)

Nathan authorized publishing the interactive AI Impacts page behind a short,
one-word password. It is live at https://www.globalriskodds.com/ai-risk;
the apex domain redirects to www. The password and session secrets are
server-side environment variables, never committed or bundled in the client.

- Eight separately defined survey outcomes, representative green answer lines,
  full-data percentiles, 14 public figures and 17 sourced historical statements.
  Ranges are ranges; qualitative quotes have no numerical markers.
- Live anonymous viewer forecasts and three-way usefulness votes in Convex.
  Revisions replace prior contributions; five long-run probabilities total 100%.
- Server-rendered password form, seven-day HttpOnly secure cookie, protected
  chart files and a signed-token check on every AI risk query/mutation.
- See docs/ai-risk-survey.md, docs/ai-risk-public-statements.md,
  docs/ai-risk-access.md and public/ai-risk/portraits/CREDITS.md.
- Production Convex: striped-gopher-860. Vercel: goodheart/israel-iran-dashboard.
  CLI44 is too old to upload: use pnpm --ignore-workspace dlx vercel@latest.
  Production candidate dpl_7Jqx4AbQhNbqJv4LBrManymztvWt was promoted successfully.
- Full lint and 33 automated tests pass. Live Chrome for Testing checks pass:
  wrong/correct passwords, denied direct API/files/encoded paths, forecast and
  usefulness vote persistence, mobile layout, and relocking. Test submissions
  removed; no page errors. Main dashboard remains public.
- Staging's Vercel SSO credential access was rejected by automatic approval;
  no credential was obtained and no Vercel protection was disabled. Verification
  used the authorized live deployment and the page's actual password instead.
- Feature checkpoints and earlier notes remain on
  codex/ai-risk-deployment-checkpoints. The feature is squashed for main under
  feat: publish password-protected AI risk explorer.

Use pnpm --ignore-workspace in this checkout. No new project dependencies were
installed. Never launch the real Google Chrome application; use Chrome for
Testing. The plain Vite preview has no server gate; the documented local gate
runs on port 4177. Server secrets are in the ignored local environment file.
