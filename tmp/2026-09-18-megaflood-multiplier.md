# Megaflood: El Niño multiplier check (2026-09-18)

Trigger: a proposed revision to 10–13% (2.5–3% × ~4, "7/8 megastorms fall in moderate+ El Niño winters").

## The arithmetic
P(mega | EN) = P(mega) × P(EN | mega) / P(EN). Multiplier = P(EN | mega) / P(EN).
- P(EN | mega): 7 of 8 (8 of 8 rounding), Huang & Swain 2022. n = 8, so wide: Beta(1,1) posterior mean 0.80.
- P(EN): the page/doc says "a quarter to a third of all years", uncited.

## What NOAA's ONI says (computed from cpc.ncep.noaa.gov/data/indices/oni.ascii.txt, winter peak over OND–JFM)
- Peak ONI ≥ 1.0 (moderate+): 14 of 76 winters = 18%.
  1957-58, 1963-64, 1965-66, 1972-73, 1982-83, 1986-87, 1987-88, 1991-92, 1997-98, 2002-03, 2009-10, 2015-16, 2018-19, 2023-24
- Peak ONI ≥ 1.5 (strong+): 9 of 76 = 12%.
- "A quarter to a third" is roughly the rate of ANY El Niño (ONI ≥ 0.5), not moderate+. So the doc's ×2–3 is too low on observed frequencies.
- Multiplier on observed 18%: ×4.8 (7/8), ×4.3 (posterior mean 0.80). The proposed ×4 is, on this basis, slightly conservative.

## The caveat that cuts the other way
The 7/8 is measured inside CESM1-LENS, not observations:
- 8 events = top 4 thirty-day events in 1996–2005 plus top 4 in 2071–2080 (RCP8.5).
- El Niño defined by ENSO Longitude Index with fixed thresholds (moderate 170–179°E, strong ≥179°E).
- The paper does not state how often ELI ≥ 170°E occurs in the model in those decades (checked PMC full text). CESM1's ENSO is known to be over-strong, and ELI tends to drift east under warming in many models (Erickson & Patricola 2023: 48% of simulations shift El Niño-like). If mod+ years are 35–50% of model years, multiplier is only ×1.75–2.5.
- Correct denominator = model frequency, not the observed 18%. Unknown → this is the crux.

## Other evidence on the page
- Instrumental: 2 of 9 strong El Niño winters had a 9-inch month vs 12 of 131 overall → ×2.4 (tiny n).
- This event is forecast beyond every analog (RONI ~3.0); 2015-16 (very strong) was dry in California.

## Where that leaves it
Multiplier plausibly ×2 to ×5 → 5–15% on a 2.5–3% base. The proposed 10–13% sits inside that, upper half.
The page's current headline (~3%, unconditioned) is the odd one out: we know it is an El Niño winter.

Sources: https://pmc.ncbi.nlm.nih.gov/articles/PMC9374343/ · https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt · https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2022JD037563
