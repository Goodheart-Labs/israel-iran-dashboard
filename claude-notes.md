# Claude session notes

## Current work: El Niño 2026-27 dashboard at /elnino (2026-09-11)

Nathan asked for a Global Risk Odds page on the record-strength El Niño and
what it means for California, prompted by a tweet claiming ~2.5% megaflood odds.

- `src/routes/elnino.tsx`: new topic page. Top strip = four "California this
  winter" tiles (very wet winter ~75%, coastal flooding ~90%, megastorm ~70%,
  megaflood ~3%). Nothing on any exchange prices these, so they are Goodheart
  Labs estimates, each with a resolvable definition, the reasoning and sources
  behind a `<details>`. Below: five market cards (peak RONI ≥2.5 = strongest
  since 1950, Super El Niño ≥2.0, the 2.0–2.5 ladder bands, 2026 and 2027
  hottest year on record). Caveats + SuggestionsPanel scoped to topic "elnino".
- `TopicDashboard` gained an `intro` slot (between title block and grid).
- `convex/predictions.ts`: 8 El Niño configs (category "climate", added to
  schema); `seedInitialMarkets` takes `{ only: [chartGroups] }` so one page can
  be seeded without re-creating retired markets from the others.
- Kalshi API moved to dollar-string fields (`last_price_dollars`,
  `price.mean_dollars` in candlesticks) and left the old cent fields null, so
  the poller had silently stopped in March (prod Kalshi market 184 days
  stale). `convex/sourceParsing.ts` holds the shared parsers; kalshiPoller,
  seed and history import now use them. Seeded Kalshi sourceUrls carry the
  exact ticker as a `#FRAGMENT` so the poller no longer matches by title.
- Metaculus group sub-questions supported via `?sub-question=<id>` in
  sourceUrl (post 21095 "warmest year" group, subs 21098 = 2026, 45424 = 2027).
- Header tagline "The world, in probabilities." removed (nav + meta descriptions).
- Second pass (same day) after Nathan's review: title is "California El Niño
  '26-'27"; the four tiles now carry their base rate and analog rate on the
  face, hover/click opens a popover with the definition in physical units
  (inches statewide Dec–Feb, days above the LA tide gauge's NOAA minor flood
  level, inches in a calendar month, ARkStorm-scale 30-day total) plus the
  rows and arithmetic; a "How the California numbers are made" section sits
  above the caveats. Numbers moved a lot once computed from data: very wet
  winter 75% → 55% (only 3 of 9 strong El Niño winters were top-20%),
  coastal 90% → 60% (definition tightened to ≥3 flood days at LA), megastorm
  70% → 20% (physical 9-inch-month definition instead of a FEMA proxy),
  megaflood 3% unchanged. `scripts/elnino_estimates.py` (stdlib only) pulls
  NOAA Climate at a Glance, NOAA CO-OPS high-tide-flooding counts and the CPC
  RONI table and prints the tables; `docs/elnino-estimates.md` holds the
  working plus that output, dated 2026-09-11.
- Shipped 2026-09-11 evening on Nathan's "put it live, don't put it in the
  top bar": /elnino is reachable by URL only (no tab, like /hantavirus).
  Branch merged fast-forward into main and pushed; Vercel prod build runs
  `convex deploy`; then prod seeded with `seedInitialMarkets {only:[...]}`
  and `fetchAllMarketHistory` (see commands above).
- Nathan does not want a PR flow on this repo: branch `elnino-page` is pushed,
  PR #1 closed unmerged, draft shown via `vite --port 5173` in his browser.
  Vercel preview builds fail by design (prod Convex deploy key refused
  outside production), so pushing a branch never touches prod.
- Verified on the DEV deployment: seeded 8 markets, imported history (Polymarket
  CLOB, Kalshi candlesticks, Metaculus), both pollers 0 failures, `pnpm run
  lint` clean, headless screenshot of /elnino via `vite preview`.

Next steps (after merge — Vercel's build runs `convex deploy` to prod, and the
new "climate" category must exist there before seeding):

    pnpx convex run predictions:seedInitialMarkets '{"only":["enso_record","enso_super","enso_peak_band","hottest_2026","hottest_2027"]}' --prod
    pnpx convex run predictions:fetchAllMarketHistory --prod

Not included: Manifold "strongest El Niño ever" (54%, no poller for Manifold);
Kalshi monthly LA/SF rain (winter months not listed yet). No market exists for
California flooding; the tiles link readers to /wishlist to request one.

## Commits this session

- feat: El Niño 2026-27 dashboard with California estimates; fix Kalshi poller
- feat: base-rate tiles with hover definitions, working section, estimates script

---

## Current work: site title / link-preview rebrand (2026-09-07)

Nathan flagged that the page title and link preview still read "Iran
Geopolitical Risk Dashboard" on every route of globalriskodds.com. The static
tags in `index.html` were the only source of titles and are shared by all
routes in this SPA.

- `index.html`: title, description, keywords, og:* and twitter:* now describe
  Global Risk Odds (added og:site_name and og:url). Social scrapers only read
  this static file, so this is what fixes link previews.
- Browser tab titles per route: `staticData.title` on each topic route (Iran,
  AI IPOs, AGI, Hantavirus, Requests) and an effect in `__root.tsx` setting
  `document.title` to "<topic> · Global Risk Odds". Chose a plain effect over
  TanStack `head()`/`HeadContent` because that would render a second `<title>`
  alongside the static one in index.html.
- Left `src/routes/original.tsx` (legacy, unlinked) and docs untouched.
- No og:image exists; previews are text-only summary cards.
- Verification: `pnpm run lint` clean; served `dist/` and read titles with the
  Playwright-cache `chrome-headless-shell --dump-dom`. /agi and /wishlist show
  "AGI · Global Risk Odds" / "Requests · Global Risk Odds". Loader-backed routes
  (/, /ipo, /hantavirus) render an EMPTY body in headless Chromium, with or
  without this change (stash-tested), so their titles could only be checked
  for the fallback. Same code path as the working routes.

## Commits this session

- fix: rebrand page title and link preview from Iran dashboard to Global Risk Odds

---

## Current work: IPO headline year label timezone fix (2026-09-07)

Twitter reply (Gumbledalf, Hamburg) flagged the OpenAI card reading "6% chance
it has happened by Dec 31, 2027" against a May 2027 median. The percentage was
right; the year was wrong for viewers east of UTC. `src/routes/ipo.tsx` built
the year with `getFullYear()` on the rung's `resolveDate`, which the seed sets
to 23:59 UTC on Dec 31 2026 — already Jan 1 2027 in Europe. Berkeley viewers
(UTC-7) saw 2026, so it never showed locally. Fixed with `getUTCFullYear()`;
also dropped a no-op `.replace("by ", "by ")` on the shortLabel.

Checked siblings: `monthlyDistribution()` in `src/lib/ipoForecast.ts` uses
local month-ends on purpose (commented); the ~1h offset vs UTC rungs shifts a
negligible sliver of interpolated mass, so left alone. `TopicDashboard.tsx`
and `TimelineChart.tsx` local getters are not at year boundaries.

## Commits this session

- fix: IPO headline year label used local timezone, wrong east of UTC

---

## Current work: Luke feedback copy fixes (2026-08-21)

Luke T reviewed globalriskodds.com/ipo. Two of his points actioned this session:

- Polymarket source-card caption said "Cumulative odds … by each date" but the
  cards chart `monthlyDistribution()` (a density). Caption predated the switch
  from cumulative ladders to monthly distributions. Reworded to describe the
  density; kept the shares-actually-trading resolution sentence.
- Header subtitle said "Real-money forecasts from Polymarket" — stale since the
  blend gained Metaculus and Kalshi curves. Now matches the Iran page's
  "Forecasting data from Polymarket, Kalshi, and Metaculus".

Note: these captions are EditableInfo defaults. Verified no community text
revision overrides the Polymarket slot, so the code default is what renders.

Parked (Nathan wants to think first, do NOT implement yet):
- Labeling sources by resolution event ("first trade" vs "announcement" —
  Kalshi rules text is "confirms an IPO", an event weeks before trading).
- Unblending Kalshi announcement curves from the completion blend / two-date
  headline per company.

Known pre-launch blockers tracked in admin logseq [[AI IPO Odds Dashboard]]:
retire two resolved Iran markets (us_forces_enter, conflict_ends — both
resolved YES April 2026, still showing frozen live odds); rebrand
title/OG/favicon away from Iran-only.

## Commits this session

- copy: fix IPO chart caption (density not cumulative) and source subtitle
