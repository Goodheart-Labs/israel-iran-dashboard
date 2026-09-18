# Claude session notes

## El Niño read/review toggle + repo rename (2026-09-18)

- Repo renamed `israel-iran-dashboard` → `globalriskodds` (local folder and GitHub
  `Goodheart-Labs/globalriskodds`; old GitHub URLs redirect). The Vercel project
  keeps its old name. `Zezo-Ai/israel-iran-dashboard` links are upstream, untouched.
- Page is canonical at `/el-nino`; `/elnino` redirects there keeping `?mode` and the
  hash. Topic and vote slot ids still say `elnino:` on purpose (votes carry over).
- [Read] / [Review] switch sits top right beside the theme button
  (`TopicDashboard headerActions`). ONE layout for both modes (Nathan's ruling):
  tiles, NOAA context, charts, then "How the California numbers are made".
  Read hides every vote control (`voteMode="hidden"`, `Caveats readOnly`, no
  suggestions panel) and shows a pointer card instead of the statements.
  Review shows the 39 statements in three columns under the same heading, with all
  three vote options always open on statements (`ItemVote expanded`) and charts
  (`ChartVote mode="expanded"`), a progress bar, full caveats and suggestions.
  Statements keep their written order in review (no re-sorting while voting).
- Every data row carries `data` links to the exact series the script reads (NOAA
  Climate at a Glance CSVs, tide-gauge flood-count JSON, CPC RONI, Huang & Swain).
  Two rows are flagged secondhand (ECMWF ensemble and sea-level lift come from
  Swain's video, not a pulled dataset).
- No general "Sources" list per tile (Nathan: sources belong on the facts). Each
  source now hangs off the data row or quote it supports; the USGS ARkStorm page
  backed no specific fact and was dropped. Statement count is 31.
- Belikewater's 18 Sep revision (megastorm 10–13%) is a votable quote on the
  megaflood card, no link (it was a message to Nathan, added at his request).
- Byline is just the two names (Nathan removed the "alpha first pass…" line).
- Read mode shows the caveats box with its add form but no rating/editing
  (`Caveats readOnly`); Nathan: "read should include caveats".
- Voice: the estimates were written by Claude Fable 5.1 on 2026-09-11 (git trailers),
  so the page and docs say "Claude F5.1's number/judgment", never "we/our".
- NOT built yet: the periodic LLM headline from checked statements (grow rule:
  ≥1 useful vote and positive net score). Needs an Anthropic key in the Convex env.
  Spec: `tmp/2026-09-18-elnino-review-spec.md`.
- Megaflood multiplier check: `tmp/2026-09-18-megaflood-multiplier.md`. The doc's
  "a quarter to a third of years are moderate+ El Niño" is wrong on NOAA ONI
  (14 of 76 = 18%); page numbers NOT yet changed, Nathan to rule.

Validation: build and full lint pass. Headless Chrome for Testing at 1280/768/375:
read, review and alias render, no console errors, no horizontal overflow, a vote
updates the chip and the counter, tile popover link lands on the right review anchor.

Commits: feat: read/review toggle on el nino page, /el-nino alias, repo renamed to globalriskodds
feat: el-nino canonical url, one layout for read and review, dataset links, Claude F5.1 attribution
feat: sources live on the facts, add Belikewater revised megastorm estimate
feat: caveats in read mode, drop alpha line

## Word-labelled slider in both chart views (2026-09-15)

Nathan requested a slider with words at each position, like the local dashboard.
Asked which control he meant; with no response, stated the above-chart selector
interpretation. The existing five-outcome view already had this design, while
the extinction-risk view still used three pill buttons.

- OutcomeSelector now shares the same labelled range control across both
  groups. Five outcomes remain Bad through Good; risk positions are Extinction /
  disempowerment, Within 100 years, and From loss of control.
- Each label is clickable; the range snaps between the corresponding original
  survey questions and supports dragging and keyboard navigation. Accessible
  value text reflects the selected words.
- Risk labels receive enough room to wrap on mobile; obsolete pill styles
  removed. Five-outcome layout, quotes/arrows, and submission controls unchanged.
- Files: OutcomeSelector.tsx and outcome-selector.css.

Validation: build and full lint pass. Chrome for Testing verified all eight
question mappings/counts, clicks, dragging, Home/End/arrows, label bounds and
overlap at 1200/768/375px, and clearing the selected arrow on question change.
Screenshots inspected. Live verification follows deployment.

Commit: feat: use word-labelled sliders for every AI risk chart view

## Pinned person arrow and hover quotes (2026-09-15)

Nathan clarified that clicking a person should keep their main connector,
while hovering any face should show that person's quote. Only other people's
faded connectors should be absent.

- AiRiskPage separates selectedQuote (pinned arrow) from visibleQuote (quote
  card and focus mode). Dismissing a card preserves the selected arrow.
- DistributionChart renders one stronger connector with an arrowhead for the
  selected person. Hover/focus previews another quote without changing the pin.
  A 200ms exit grace lets the pointer cross into the card for links/votes; it
  rechecks keyboard focus before hiding. Range/bound endpoints retain their
  existing semantics. No background public-figure connectors are rendered.
- QuotePopover skips focus and scrolling for hover previews. Keyboard/touch
  activation still opens and focuses the card; Escape returns focus when the
  card had focus. aria-pressed reflects the pin; expanded/controls the preview.
- Changing outcome/audience clears stale selection and preview. Green survey
  stems, forecast sliders, source credit, and backend are unchanged.

Validation: build and full lint pass. Chrome for Testing checks pin persistence,
independent hover cards, no hover scroll/focus movement, pointer gap crossing,
correct hovered-person vote storage, dismissal, keyboard/touch, sort/audience
and outcome changes, and 1200/768/375px layouts. Screenshots reviewed; temporary
test votes removed. Local/live completion is checked before the final reply.

Commit: feat: keep selected person arrow with independent hover quotes

## Chart submission sliders (2026-09-15)

Nathan requested sliders for viewers to submit probabilities for the chart's
different outcomes. ForecastForm now sits within the chart panel, directly
below the plot/source and above public statements. Five compact rows share the
chart's Bad, Quite bad, Middle, Quite good, Good labels, with sliders and exact
percentage inputs. Total must equal 100% before submission.

- Unsaved outcome probabilities initialize to explicit zero, so leaving some
  sliders untouched does not block an otherwise complete allocation. The
  separate extinction-risk estimate remains blank until answered.
- The existing outcomes component key preserves drafts when switching among
  the five chart categories. Persistence, original outcome IDs, 0.1% precision,
  saved YOU markers, and server validation are unchanged.
- Reduced row/input/heading sizes and moved labels alongside sliders; mobile
  keeps all five controls in one column. Source credit remains unchanged.
- Files: AiRiskPage.tsx, ForecastForm.tsx, ai-risk.css.

Validation: production build, full lint, and Chrome for Testing pass. Verified
untouched zeros, invalid totals, each slider's keyboard/number synchronization,
draft preservation, correct five-outcome storage, reload, existing outcome
selector and quote popovers, and 1200/768/375px layouts. Screenshots inspected;
temporary test forecast removed. Live verification follows publication.

Commit: feat: put viewer submission sliders inside AI risk chart

## Five labelled outcome stops (2026-09-15)

Nathan requested a slider with Bad, Quite bad, Middle, Quite good and Good.
Replaced the dropdown/unlabelled eight-question slider with five labelled,
clickable stops and compact Outcomes / Extinction risk tabs.

- The stops map to extremely-bad, bad, neutral, good, extremely-good in that
  order. Native range supports dragging and keyboard control; labels are also
  buttons. OutcomeSelector.tsx + outcome-selector.css own the selector;
  outcome-options.ts exports the shared order/labels for the forecast form.
- Five outcomes are the default (initially Bad). An optional question about
  keeping extinction risk as default received no reply; root stated this
  assumption after allowing time to respond. Extinction risk still provides
  the three original risk questions and their sourced public figure quotes.
- These five distributions use their actual conditional survey categories,
  not the direct extinction-risk answers. Subtitle retains official category
  wording and the human-level-AI condition. Docs/methods explain short labels.
- Viewer allocation fields use the same Bad-to-Good order and original outcome
  IDs. Five values still sum to 100%; no backend or survey data changes.

Validation: production build and full lint pass. Chrome for Testing verified
all five labels and question mappings, click/drag/keyboard controls, all three
risk variants, face quote popovers, correctly stored five-value allocations,
and non-overlapping labels at 1200/768/375 pixels. Screenshots reviewed; test
forecast removed. Live verification follows the push.

Commit: feat: add labelled five-step AI outcome slider
Live: https://www.globalriskodds.com/ai-risk
Share: /ai-risk-access#password=ENCODED_PASSWORD
Server environment holds password/session secrets. Private chart remains in
ai-risk-* bundles. See docs/ai-risk-access.md and docs/ai-risk-survey.md.
Production: Vercel goodheart/israel-iran-dashboard; Convex striped-gopher-860.
Use pnpm --ignore-workspace and Chrome for Testing, never real Google Chrome.
Local gate 4177 forwards built preview on 4176.
