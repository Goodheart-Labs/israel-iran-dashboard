# Public AI-risk statements for GlobalRiskOdds

Checked 2026-09-15. The application-ready file is `finding-consensus-quotes.json`, matching `PublicFiguresData` in the GlobalRiskOdds app. It contains 14 figures and 17 quotations: 13 numerical estimates from 11 people, plus four qualitative records. Multiple Christiano estimates concern different outcomes. All comparison labels are `related`, because these figures did not answer the AI Impacts survey question in a controlled comparison.

All 14 portraits are saved at `globalriskodds/public/ai-risk/portraits/<figure-id>.jpg`. They are 300 × 300 JPEGs totaling about 269 KB, and the final JSON uses their local paths. `CREDITS.md` in that directory documents each source and license. Wikimedia crops retain their listed Creative Commons licenses. Daniel Kokotajlo, Eli Lifland, Paul Christiano and Scott Alexander have public team, personal-site or interview portraits whose pages do not state reuse licenses. Scott's image is a crop of his public Dwarkesh appearance, not a namesake or a private image.

## Numerical statements

| Figure | Estimate | Original outcome / caution | Primary source |
| --- | --- | --- | --- |
| Daniel Kokotajlo | 70% | Doom includes loss of control and concentration of power. No fixed horizon attached to the number. | [Dwarkesh Podcast, 2025-04-03](https://www.dwarkesh.com/p/scott-daniel) |
| Scott Alexander | 20% | His definition explicitly excludes oligarchy; not the probability of the AI 2027 scenario. | [Dwarkesh Podcast, 2025-04-03](https://www.dwarkesh.com/p/scott-daniel) |
| Geoffrey Hinton | 10–20% | Human extinction within 30 years. Historical statement. | [WBUR interview, 2025-01-10](https://www.wbur.org/onpoint/2025/01/10/ai-geoffrey-hinton-physics-nobel-prize) |
| Paul Christiano | 46% | Irreversibly ruining the future within 10 years of powerful AI; broader than extinction. | [Authored post, 2023-04-27](https://www.lesswrong.com/posts/xWMqsvHapP3nwdSW8/my-views-on-doom) |
| Paul Christiano | 22% | AI takeover, not necessarily extinction; includes later systems. | Same authored post |
| Paul Christiano | 20% | Most humans die within 10 years of powerful AI; includes several causes, and most is not all. | Same authored post |
| Yoshua Bengio | 20% | Historical 2023 catastrophe estimate. He declined to update it in 2026. | [ABC interview, 2023-07-15](https://www.abc.net.au/news/2023-07-15/whats-your-pdoom-ai-researchers-worry-catastrophe/102591340) |
| Lina Khan | 15% | Asked whether AI kills us all; no stated horizon. | [Hard Fork exchange reproduced by its co-host, 2023-11](https://www.platformer.news/how-banning-one-palestinian-slogan-roiled-etsy/) |
| Elon Musk | 10–20% | An approximate range for a dystopian future in the context of digital superintelligence ending humanity. | [Interviewer's account of Abundance Summit, 2024-03-19](https://www.diamandis.com/blog/elon-abundance-ai-human-survival) |
| Dario Amodei | 25% | AI disaster; point estimate, no inequality and no stated horizon. The source has a 25-word total reuse limit, so keep its display context minimal. | [Axios interview, 2025-09-17](https://www.axios.com/2025/09/17/anthropic-dario-amodei-p-doom-25-percent) |
| Eli Lifland | 35–40% | Any AI-mediated existential catastrophe in a discussion of risk by 2070. Do not convert this to exactly 35%. | [Interview posted by Lifland, 2023-02-01](https://forum.effectivealtruism.org/posts/QeLE22fefLqKfYTW6/eli-lifland-on-navigating-the-ai-alignment-landscape) |
| Lee Cronin | 0% | AGI doom, distinguished from humans misusing technology. | [Lex Fridman interview, 2023-12-09](https://lexfridman.com/lee-cronin-3-transcript/) |
| Lex Fridman | 10% | His own probability before asking Pichai; do not attribute it to Pichai. | [Sundar Pichai interview, 2025-06-05](https://lexfridman.com/sundar-pichai-transcript/) |

## Qualitative records

- Bengio declines an updated probability in his [80,000 Hours interview published May 7, 2026](https://80000hours.org/podcast/episodes/yoshua-bengio-scientist-ai/). This is included alongside his historical numerical statement.
- Nate Silver describes his view as in line with a 5–10% expert range, without directly assigning exact personal bounds, in [his January 2025 essay](https://www.natesilver.net/p/its-time-to-come-to-grips-with-ai). The record is qualitative and should not receive a made-up chart point.
- LeCun's [Financial Times interview](https://www.ft.com/content/30fa44a1-7623-499f-93b0-81e26e22f2a6) describes existential-risk discussion as premature. The original is paywalled; the excerpt was verified against Finding Consensus's existing public record.
- Ng's [TIME essay](https://time.com/collection/time100-voices/7016134/california-sb-1047-ai/) concerns SB 1047 and open models. The original fetch failed, so the excerpt was verified against Finding Consensus. Its `outcomeIds` is empty because it is a policy quote, not a forecast.

## Finding Consensus and exclusions

The existing Finding Consensus project is `/Users/natha/Documents/Source/sb1047-opinions`. Its public database was read in a read-only transaction using its configured connection; no credentials were copied or printed. The export in `finding-consensus-public-records.json` contains 63 public responses across six questions. These questions concern SB 1047. Their editorial numeric scores are not public figures' p(doom) estimates and must not become chart markers. Finding Consensus provided source leads and contextual quotations, with the original attribution retained.

[PauseAI's p(doom) list](https://pauseai.info/pdoom) was used for discovery only. Some tempting entries were excluded after checking context:

- Reid Hoffman's alleged 20% was a response of 2 on a 1–10 threat scale in [a PBS interview](https://www.pbs.org/video/future-of-ai-1724451272/), not a probability.
- LeCun's alleged extremely small percentage was not verified as his own numerical probability. Qualitative comparisons and other people's speculation are insufficient.
- Holden Karnofsky's 10–90% bounds concern a conditional nearcast and should not be simplified to an unconditional point estimate.
- Eliezer Yudkowsky and Roman Yampolskiy numbers circulating in aggregators were not added without directly checking the attributed numerical statement and conditions.

Short direct quotations total at most 25 words per shared source page. `build_public_figures.py` checks this when rebuilding. The JSON retains dates, original outcomes, horizons, conditions, source links and historical-versus-current distinctions. No qualitative claim was converted into a numeric estimate, and no midpoint was substituted for a range.
