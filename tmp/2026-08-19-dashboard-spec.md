# Dashboard spec — everything Nathan has asked for

Target site: **globalriskodds.com** = this repo (`israel-iran-dashboard`, Vite + TanStack + Convex).
Updated 2026-08-19 with Nathan's notes folded in. **This file is the source of truth.**

Status: **✅ done** · **🟡 partial** · **❌ todo** · **👻 exists in `big-risk-odds` (Next.js), needs porting**

Working rule: **one item at a time**, then check in.

---

## A. The IPO forecast — method

| # | Decided | Status |
|---|---|---|
| A1 | Headline = **a day** per company. It looked better in the Next version — restore that look. | 🟡 exists, needs restyling |
| A2 | Header symmetric, both dates one line | ✅ |
| A3 | **Three sources in the blend**: Polymarket + Kalshi + Metaculus | ✅ all three live |
| A4 | **Blend by day. No per-source medians** — average the curves daily, read the day off the blend | ✅ per-source medians removed from UI |
| A5 | Top chart = **probability distribution function per company** | ✅ |
| A6 | One market per platform per company (Polymarket, Kalshi, Metaculus) | ✅ |
| A7 | No who-first markets | ✅ |
| A8 | No Manifold | ✅ |
| A9 | **Kalshi** — order-book midpoints | ✅ `convex/ipoCurves.ts` |
| A10 | **Metaculus** — 201-point CDF from `latest.forecast_values` | ✅ |
| A11 | Any source in the cards below is also in the central chart | 🟡 central chart blends all 3; cards below still show Polymarket rungs only |

## B. The IPO page — layout

| # | Decided | Status |
|---|---|---|
| B1 | Big central chart = probability distribution per company | ✅ |
| B2 | Per company: **one probability-distribution chart per source**, plus **one blended over-time chart**. Matches the standalone build. | ✅ |
| B3 | **Two-column layout must go** — breaks on mobile | ✅ single column, stacked |
| B4 | Individual charts: windowed Jun '26 – Dec '27 | ✅ |
| B5 | Top chart windowed, legend top, no dots | ✅ |

## C. Community layer

| # | Decided | Status |
|---|---|---|
| C0 | **Wiki-editable info boxes** on each chart, like the standalone | ✅ `EditableInfo`, shares the append-only revision log |
| C1 | Caveats votable: Helpful / Somewhat helpful / Not helpful | ✅ on Convex |
| C2 | Add-a-caveat box at the bottom | ✅ |
| C3 | Voting in a drawer, right-aligned trigger | ✅ daisyUI modal, right-aligned link |
| C4 | Edit + history + revert, public wiki-style | ✅ append-only `textRevisions` |
| C5 | Requests accept **URLs** as well as text | ✅ optional link field |
| C6 | Request panel at the bottom of each topic, **and duplicated on the Requests page** | ✅ now scoped per topic; Requests page shows all |
| C7 | Requests page also takes **topic** requests; topics and markets in one ranking | ❌ |

## D. Site structure

| # | Decided | Status |
|---|---|---|
| D1 | Serve at globalriskodds.com | ✅ |
| D2 | Tabs: **Iran · AI IPOs · Requests** | ✅ |
| D3 | **No bird flu** | ✅ by omission |
| D4 | Original Iran page untouched | ✅ |
| D5 | **If in doubt use the new styling. Build first, style after.** | — |
| D6 | ~~AGI timelines~~ — **dropped 2026-08-19.** Page, seed and markets removed. The log-scaling fix it surfaced stays. | ✅ removed |

---

## Order (Nathan to reorder freely)

1. ~~A3 + A9 + A10 — all three sources in the blend~~ ✅
2. ~~C1–C4 — caveats, voting, drawer, edit/history/revert~~ ✅
3. ~~B2 + B3 — per-org sections, one chart per source, over-time chart~~ ✅
4. A1 — restore the headline styling from the Next build
5. C7 — topic requests ranked alongside markets — requests take URLs; topic requests; one ranking

## Done this session (not yet committed)

- `/ipo` rebuilt in daisyUI: median headline, central distribution chart, per-company cards, notes, requests panel
- Tabs added to `__root.tsx`
- Log-scaling bug fixed in `TimelineChart` (weak AGI read 2120, should be 2028)
- Found: this deployment's `METACULUS_API_KEY` works; the one in `agi-timelines-dashboard` is the broken one
