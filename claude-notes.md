# Claude session notes

## AI risk page styling and password link (2026-09-15)

Nathan requested a simpler page matching Global Risk Odds, with clustered faces,
only the selected person's connector, and quotes followed by their number and
accuracy votes. He explicitly requested removal of the median, sidebar counters,
Daniel summary, and interpretive commentary. The outcome slider belongs inside
the top of the chart. Prior authorization to publish the protected page persists.

- Slate/white site styling; no hero counters, median badge, numbered section
  captions, duplicate person summary, or full wall of quote cards.
- All numerical portraits cluster near weighted survey percentiles on desktop
  and mobile. Only the selected person connects to the plot. Ranges preserve
  endpoints. No default hovered answer; the 100 green survey stems remain.
- Clicking a face shows its dated, sourced quote and displayed estimate.
  Separate Yes / Somewhat / No buttons ask whether the number summarizes the
  quote and whether the quote is accurate. New number-accuracy / quote-accuracy
  slots preserve previous usefulness votes without reinterpreting them.
- Outcome selector and slider sit at the top of the chart; all statements remain
  available in a collapsed list. Viewer forecasts and hidden methods remain.
- Share links use /ai-risk-access#password=ENCODED_PASSWORD. The server-rendered
  gate removes the fragment, submits the usual password form, and verifies it
  normally. It handles a link opened while already on the login page and clears
  fragments for already authenticated users. Manual login remains available.
- Session/password secrets stay in ignored environment variables; none are
  bundled or committed. The private chart data remains in an ai-risk-* chunk.

Validation: full production build, full lint, and 45 automated tests pass.
Chrome for Testing checks passed on the local protected preview at 1200, 768,
and 375 pixels: password links, wrong password, two independent votes and
revisions, reload persistence, forecast saving, face selection, range markers,
reversed order, outcome slider, and no horizontal overflow or page errors.
Test submissions were removed. Live deployment verification follows the push.

Feature commit: feat: simplify AI risk chart and add password share links
Live URL: https://www.globalriskodds.com/ai-risk
Production: Vercel goodheart/israel-iran-dashboard; Convex striped-gopher-860.
Use pnpm --ignore-workspace. No new dependencies. Never launch real Google
Chrome: use the documented Chrome for Testing binary. Preview gateway runs
scripts/preview_ai_risk_gate.ts on 4177, forwarding built preview on 4176.
