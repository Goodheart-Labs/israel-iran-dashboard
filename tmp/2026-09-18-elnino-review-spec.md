# El Niño page: read / review + voted headline (spec, draft 1)

2026-09-18. Status: discussing, nothing built. Decisions marked ✅ are Nathan's; ❓ are open.

## Why

Nathan: the page is ugly, and it carries ~40 statements he hasn't checked. He wants the
Spilled Ink shape: bottom statements get checked by votes, and a short headline is
regenerated from whatever has survived checking.

## Decisions so far

- ✅ A [Read] / [Review] toggle. Review is where you vote on every piece.
- ✅ Headline = 1–2 sentences, LLM-written, regenerated periodically (Spilled Ink style), not per page view.
- ✅ Grow rule: a statement only feeds the headline once it has ≥1 "useful" vote and a
  positive net score (`useful + 0.5 × somewhat − not_useful > 0`). Same as Spilled Ink's
  `eligible()` minus the fake-quote/duplicate flags, which this site doesn't have.
  Consequence: the headline starts empty and grows as statements get checked.

## What exists today (so we reuse, not rebuild)

- `src/routes/elnino.tsx` hard-codes 3 tiles → 9 data rows, 3 "our number" paragraphs,
  18 verbatim quotes, 9 sources. Every one already has an `ItemVote`
  (`convex/chartVotes.ts`, anonymous one-vote-per-browser, slots like `elnino:quote:wet:<hash>`).
- Market blurbs (`GROUP_RESOLUTION.summary` / `.notice`) contain factual claims with no vote.
- Scoring helper: `src/lib/helpfulness.ts`.
- No LLM call anywhere in `convex/`. No Anthropic key in the Convex env (dev or prod).

## Proposed shape

### Statements
Move the tile data out of the route into `convex/elninoStatements.ts` (plain exported
constants; the route imports it, the server action imports it). Each statement gets a
stable `slot` computed exactly as today so existing votes carry over.

Kinds, because they are checked differently:
| kind | example | "checked" means |
|---|---|---|
| quote | Swain, 41:46, ">70% chance…" | the source says this at that link |
| data | "3 of 9 strong El Niño winters were top-20% wet" | the script reproduces it |
| judgment | "Our number ~65%, leaning to the model because…" | reader agrees with the reasoning |
| context | "CPC's RONI record peaks at 2.4 (1982-83)" | currently unvotable; make votable |

### Read mode (default)
- Headline at the top, with "based on N checked statements · updated <date>" and a link into Review.
- Empty state: "Nothing checked yet. Switch to Review and vote."
- The three tiles, as now (they are the good part).
- Markets as compact rows (title · current % · sparkline), not five half-screen charts.
  Click to expand the full chart + rules.
- No vote pills, no working tables.

### Review mode
- One column. Per tile: definition, then statements as cards (text · source link · vote),
  grouped by kind, judgment last. No 4-column tables.
- Unchecked statements first; a counter "12 of 40 checked".
- Headline shown with its cited statements highlighted.

### Headline generation
- `convex/elninoHeadline.ts`: internal action, hourly cron.
- Build eligible set → fingerprint (slot + text + model + prompt version). Unchanged → skip, no API call.
- Prompt: 1–2 sentences, ≤45 words, plain English, only claims supported by the supplied
  statements, numbers verbatim, return cited slots. Reject output citing unknown slots; keep the previous headline on any failure.
- Store in a `headlines` table `{topic, text, citedSlots, fingerprint, model, generatedAt}`; page reads latest.
- Model `claude-fable-5-1`, plain `fetch` to the Messages API (repo rule: ask before adding deps).

## Open
- ❓ Live market prices in the headline? They move by the minute; the headline is hourly.
  Proposal: headline never quotes a market price; tiles/rows show them live.
- ❓ Should judgment statements ("our number") be eligible at all, or only quotes + data,
  with the headline stating our numbers only when their supporting rows are checked?
- ❓ Anthropic key for Convex dev + prod.
- ❓ Route slug: `/elnino` today. Rename to `/el-nino` with a redirect?
- ❓ Roll the same pattern to `/hantavirus` later? (Both use `TopicDashboard`; build it topic-agnostic if yes.)
