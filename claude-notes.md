# Claude session notes

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
