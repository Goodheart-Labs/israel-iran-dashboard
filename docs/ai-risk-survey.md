# AI risk explorer: survey data and calculations

The visible source credit is **Source: Expert Survey on Progress in AI 2024, AI Impacts**. The data show respondents' estimates of possible outcomes. They are not measured event probabilities or a representative sample of all AI researchers.

## Source

- [Supplied 2024 anonymized CSV](https://aiimpacts.org/wp-content/uploads/2026/09/2024-expert-survey-anonymized.csv): 1,793 records, 335 columns. The survey year comes from the filename; the upload path is not the collection date.
- [AI Impacts methodology FAQ](https://blog.aiimpacts.org/p/faq-expert-survey-on-progress-in): confirms a 2024 survey and discusses earlier survey methods. It does not independently verify the exact wording or recruitment for this file.
- [Published 2023 field codebook](https://github.com/tadamcz/espai/blob/main/data/fields.csv) and [2023 questionnaire](https://wiki.aiimpacts.org/_media/ai_timelines/predictions_of_human-level_ai_timelines/ai_timeline_surveys/2023_espai_paid.pdf): establish the interpretations of the matching fields. Exact 2024 wording has not been independently verified. The page's descriptions are explanations of the questions, not claims to transcribe a verified 2024 questionnaire.

All plotted counts and statistics are calculated from the 2024 CSV. No earlier survey results are substituted. Source SHA-256:

```text
fd26d40b078aaa147e2fa8a020edef895b37d5d666ca27f52db5631efd01e39a
```

The public JSON contains only value/count histograms and question metadata. It does not include respondent-level survey records or any identities. Public figures' statements and visitor submissions are separate datasets; a public figure's position on this chart is a comparison, not evidence that they answered this survey.

## Question conditions and denominators

Three risk questions are kept separate. Each concerns human extinction or similarly permanent and severe disempowerment of the human species.

| Outcome ID | Source field | Additional condition | Valid answers | Mean | Median |
| --- | --- | --- | ---: | ---: | ---: |
| `extinction` | `extinction_all_1` | Future AI advances; no time limit specified | 744 | 18.312774% | 10% |
| `extinction-century` | `extinction_100_1` | Within the next 100 years, measured from the survey | 353 | 17.544491% | 5% |
| `loss-of-control` | `extinction_control_1` | Caused by human inability to control future advanced AI systems | 392 | 18.520392% | 9% |

The five long-run outcome categories are a different question. They are conditional on high-level machine intelligence eventually existing. Respondents allocated 100% probability among these five outcomes; each complete vector contributes one answer to each category.

| Outcome ID | Source field | Category | Valid complete vectors | Mean |
| --- | --- | --- | ---: | ---: |
| `extremely-good` | `vb_1_1` | Extremely good | 1,538 | 23.8677% |
| `good` | `vb_1_2` | On balance good | 1,538 | 27.7267% |
| `neutral` | `vb_1_3` | Approximately neutral | 1,538 | 20.6516% |
| `bad` | `vb_1_4` | On balance bad | 1,538 | 17.8180% |
| `extremely-bad` | `vb_1_5` | Extremely bad, with human extinction as an example | 1,538 | 9.9361% |

“Extremely bad” is not interchangeable with the direct extinction/disempowerment questions. Category means are average assigned probabilities, not the percentage of researchers selecting a category. The three risk questions do not combine with these five categories into a single probability allocation.

## Inclusion and computation

There is no `Finished` filter. Available valid answers from partially completed surveys are included. Each risk question independently includes finite numeric answers from 0 through 100. Missing, nonnumeric, and out-of-range cells are excluded, never converted into zero. The five outcome fields require a complete numeric vector, every component in 0–100, summing to 100 within an absolute tolerance of 0.00000001. The source is checked by hash and expected valid-answer counts during export.

`src/data/ai-risk-survey.json` stores every distinct observed probability with its exact answer count. Histogram counts are frequencies, not survey weights. Means and medians are computed over all included answers. For even sample sizes, the median is the average of the two middle observations. Calculations retain numeric precision; only presentation labels are rounded.

The green line display takes 100 representative observed answers from the sorted distribution. For zero-based mark `i`, it selects the zero-based response rank `floor((i + 0.5) × n / 100)`. This preserves the established chart's representative marks and does not interpolate nonexistent probabilities. Display marks are not individual named respondents. Statistics and hover percentiles use all answers, not these 100 marks.

For a probability `p`, the percentile helper reports the shares of all answers strictly below `p`, equal to `p`, and strictly above `p`. Its midpoint percentile is `100 × (below count + equal count / 2) / n`. A figure with an imprecise range, one-sided bound, or different outcome definition must not be presented as an exact survey answer; these distinctions belong with its quote and chart annotation.

At 70% in the unrestricted question, 687 of 744 answers are lower, 17 equal, and 40 higher. The midpoint is **93.4811827957th percentile**. Representative marks **93, 94, and 95** (one-based) are 70%. A percentile from those three marks would only approximate the full-data percentile.

Empty helper distributions return `n: 0`, numeric summary/percentile values of zero, and an empty representative array. Callers should display an empty state rather than treating the zero summaries as observations.

## Reproduce and check

From this repository:

```sh
python3 scripts/export_ai_risk_survey.py
node --import tsx --test tests/ai-risk-distribution.test.ts
```

By default the exporter reads the existing sibling project at `../ai-impacts-survey-charts/data/2024-expert-survey-anonymized.csv`. A different local source location can be passed with `--source /path/to/2024-expert-survey-anonymized.csv`; the expected source hash still applies. `--output` changes the JSON destination. The exporter uses only Python's standard library and does not fetch or upload data.

The tests cover count-weighted statistics, even/odd medians, representative observed values, tied ranks, 0% and 100% endpoints, empty inputs, all exported denominators, and the 70% comparison against the full source distribution.
