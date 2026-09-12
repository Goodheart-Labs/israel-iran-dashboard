# California this winter: how the /elnino tile numbers are made

Computed 2026-09-11. Nothing on any exchange prices these events, so the four
tiles at the top of globalriskodds.com/elnino are our own numbers. Each one is
built the same way: a definition in physical units, the base rate over the
whole record, the rate in the strong El Niño winters since 1950 (the analogs),
the official model forecasts where they exist, and then our number with the
arithmetic shown. Re-run the data section with:

    python3 scripts/elnino_estimates.py

Analog winters are the nine since 1950 whose peak three-month RONI (NOAA CPC's
climate-adjusted El Niño index) reached 1.5 or more. The 2026-27 event is
forecast to peak near 3.0, well beyond the strongest analog (2.4 in 1982-83),
so analogs are a floor for the El Niño effect, not a ceiling.

## Our numbers (revised 2026-09-11 evening after Swain's 10 Sep update)

### 1. Very wet winter: ~65% (range 45-85%)

We would count it as a yes if: California's Dec-Feb 2026-27 statewide precipitation is at least
15.1 inches, the top 20% of the 131 winters on record (median 10.8 in).

- Base rate: 20% by construction.
- Analogs: 3 of 9 strong El Niño winters (1957-58, 1982-83, 1997-98) = 33%.
  6 of 9 were above the median = 67%.
- ECMWF September ensemble, per Swain (10 Sep): ">70% chance" of a top-20%
  winter along the coast; "about two in three odds of a winter among the
  wettest 10%"; "something like a 20% chance that a significant chunk of
  California sees record wet conditions". He notes the model correctly
  hindcast 2015-16 as not wet and 1982-83 / 1997-98 as very wet.
- NOAA CPC outlook of 20 Aug 2026: above-normal precipitation odds "increased
  significantly to above 50 percent across much of coastal California".
- Our number: between the analogs (33%) and the model (>70%), leaning to the
  model for the reasons above; short of it because it is one system and an
  under-dispersed ensemble "cuts both ways" (Swain). Earlier draft said 55%.

### 2. Coastal flooding: ~75% (range 55-90%)

We would count it as a yes if: the Los Angeles tide gauge (NOAA station 9410660) records at least
3 days between Nov 2026 and Apr 2027 at or above NOAA's minor coastal flood
level, 11.18 ft on the station datum = 1.9 ft above mean higher high water.

- Base rate: 7 of 72 winters since 1950 = 10%. Last 11 winters: 3 of 11 = 27%
  (2025-26 had 6 days with no El Niño).
- Analogs: 3 of 8 strong El Niño winters with data = 38% (1982-83: 6 days,
  2015-16: 5, 1997-98: 3). For at least 1 day: 7 of 8.
- Physical lift: Swain (10 Sep) reports California sea level already 6-12
  inches above usual, "between 15 and 30" cm; NOAA's seasonal figure is 6-10
  in. The margin between mean higher high water and the flood level is 22 in.
- Swain: significant coastal flooding "is almost 100% guaranteed"; he expects
  record sea levels in San Diego and much of the state.
- Our number: the analog rate raised a long way for those reasons. Earlier
  draft said 60%.

### 3. Major storm month: ~25% (range 15-40%)

We would count it as a yes if: some calendar month from Nov 2026 to Mar 2027 delivers at least
9 inches of precipitation averaged over the whole state. Twelve winters in 131
have done it: Dec 1955, Jan 1969, Mar 1983, Feb 1986, Jan 1995 (the record,
12.5 in), Feb 1998, Jan 2017 and five before 1920. (Not the "month-long
megastorm" of Huang & Swain, which is tile 4.)

- Base rate: 12 of 131 winters = 9%.
- Analogs: 2 of 9 strong El Niño winters (1982-83, 1997-98) = 22%.
- Conditional on the winter being top-20% wet: 10 of 27 = 37%; otherwise
  2 of 104 = 2%.
- Our number: 0.65 x 37% + 0.35 x 2% = 25%, using tile 1 for the 0.65.

### 4. Megaflood, ARkStorm-scale month-long megastorm: ~3% (range 2-8%)

We would count it as a yes if: roughly 447 mm (17.6 in) or more of precipitation averaged over
the whole state in 30 days, the "ARkHist" scenario of ARkStorm 2.0 (Huang &
Swain 2022), which brings slightly less rain than the winter of 1861-62 did.
The biggest calendar month in the 131-year record is 12.5 in (Jan 1995).

- Base rate at today's warming: Huang & Swain, Fig. 5B, fit the annual
  likelihood of an ARkHist-level event as ~0.01/yr in the pre-industrial
  climate plus ~0.012/yr per degree C of global mean surface temperature
  (GMST) anomaly, on a 30-year-smoothed basis. At 1.3 C (smoothed, mid-2020s)
  that is 2.6%; at the 1.6-1.7 C some expect for the single year 2026 it is
  ~3%. The paper also states warming to date has already raised the
  likelihood ~105% relative to 1920. Instrumental cross-check: a stationary
  131-year record is beaten in a given year with probability 1/132 = 0.8%.
- El Niño: "all of the most intense 30-day megastorm events in the CESM1-LENS
  ensemble occur during moderate to strong ENSO warm phase (El Niño)
  conditions"; 7 of 8 by the ENSO Longitude Index, 8 of 8 rounding. Such
  years are a quarter to a third of all years, so a strong El Niño winter
  should carry 2-3 times the unconditioned annual rate. Our own record: 2 of
  the 9 strong El Niño winters produced one of the 12 nine-inch months, vs
  12 of 131 overall (2.4x).
- Our number: the headline is the unconditioned Fig. 5B rate, ~3%, which is
  also where the ~2.5% figure circulating online comes from (Fig. 5B read at
  2026's expected GMST). Conditioning on El Niño as above gives 5-8%. The
  range spans both readings.

## Quotes (verbatim; YouTube lines are lightly corrected auto-captions)

Swain, Weather West September update, 10 Sep 2026, https://www.youtube.com/watch?v=2v4k0nbUU1s
- 05:55 "That includes water temperatures that are warmer than they were at any point in September during 1982, 1983, 1997, 1998, 2015, 2016, or 2023, 2024."
- 07:49 "[sea levels] are 6 to 12 inches higher than usual. And already we already have a good 6 to 12 inches of sea level rise from climate change in Southern California."
- 24:57 "we're already seeing significant elevation of sea level along the California coast exceeding that 15 cm level. So, we're between 15 and 30."
- 30:38 "in general, the highest sea levels in California, the highest maximum water levels in any given year occur during the strongest [El Niño events]"
- 32:53 "I expect us to break the records in San Diego. So I think we'll probably see record sea levels in many parts of California except possibly San Francisco proper"
- 39:29 "We have well over a 70% likelihood, getting close to a 100% chance that precipitation will be among the wettest third of all winters ever measured"
- 40:17 "there is 90 to 100% chance that precipitation will be above average or above the median"
- 41:46 "a greater than 70% chance of precipitation this December through February being among the wettest 20%."
- 43:18 "this model correctly identified that 2015-2016, despite being a very strong El Niño year, would not be a very wet year in California, and also correctly identified in reforecasts that 1982-1983 and 97-98 would be very wet winters in California."
- 51:48 "the driest fifth of the ensemble is still wetter than average in California. So, if we ignore 80% of the data for this winter and only look at the driest 20% of outcomes, we still get 150% of average precipitation in coastal California."
- 59:09 "most of the coast of California is depicted as having at least a 20% chance explicitly of having the single wettest winter on record"
- 59:59 "under dispersion cuts both ways. We don't know which way it will cut this year."
- 1:00:48 "Please please please do not write a headline that there is a 61% chance of a record wet winter in San Francisco"
- 1:01:07 "It is more likely than not, probably about two in three odds of a winter among the wettest 10% we've seen. That's a more defensible headline."
- 1:01:42 "realistically there is something like a 20% chance that a significant chunk of California sees record wet conditions this winter."
- 1:02:46 "this year's odds are on the order of 20 times more likely of having a record-breaking winter than usual"
- 1:06:15 "There will be significant coastal flooding that will get worse from here. That is almost 100% guaranteed. How bad it gets will depend."

Swain, Weather West August update, 10 Aug 2026, https://www.youtube.com/watch?v=0THLEMorMDI
- 23:02 "all of our progressive sea level records have been broken during strong El Niño events. 82-83 was the highest sea level we'd ever seen in the Bay Area by a wide margin at that point in time."
- 25:46 "the single highest sea levels on record are quite possible this winter in California and that is going to be a problem."
- 34:56 "[peak RONI] at least three, if not three and a half. And that is a very very extreme record-breaking number."
- 52:33 "the wettest 20% of all winters. Now the odds along the California coast remarkably rise to 70 to 100%."
- 53:49 "0 to 10% chance of being in the driest fifth of all winters"
- 58:02 "The stats show that only about 2% of Californians have flood insurance."
- 1:01:32 "That is pretty different than the situation we had in 2015-2016 and is more akin to 82-83 or 97-98 plus, in the former case, 40 years worth of global warming"
- 1:04:52 "there's no guarantee, although the coastal flooding is about as close to a guarantee as we can get. The inland flooding is a bigger wild card"

Huang & Swain 2022, Science Advances, https://www.science.org/doi/10.1126/sciadv.abq0995
- "Recent estimates suggest that floods equal to or greater in magnitude to those in 1862 occur five to seven times per millennium [i.e., a 1.0 to 0.5% annual likelihood or 100- to 200-year recurrence interval (RI)]"
- "We find that the annual likelihood of an ARkHist level event increases rapidly for each 1°C of global warming [by ~0.012/year per degree C from a baseline of ~0.01/year]"
- "We find that climate change to date (as of 2022) has already increased the annual likelihood of an ARkHist event by ~105% relative to 1920 in the CESM1-LENS ensemble and of an even higher magnitude (200-year RI) event by ~234%."
- "We further find that all of the most intense 30-day megastorm events in the CESM1-LENS ensemble occur during moderate to strong ENSO warm phase (El Niño) conditions—both in the historical and warmer future scenarios—suggesting that these events may potentially exhibit some degree of predictability at seasonal scale."
- "Collectively, seven of eight historical and future potential California megastorm events occur under moderate or strong El Niño conditions as defined by the ELI (eight of eight, if rounding to the nearest degree of longitude)."
- "California-wide average cumulative precipitation during the 30-day periods encompassing both extreme storm sequence scenarios represents a considerable fraction of the total annual [October-September water year (WY)] precipitation occurring during both ARkHist (~447 mm or 46% of the WY total) and ARkFuture (~586 mm, of 40% of the WY total)."

NOAA CPC, ENSO diagnostic discussion, 10 Sep 2026
- "El Niño is strengthening, with a greater than 90% chance of a very strong event"
- "During the October-December 2026 season, there is a 75% chance of a historic event" that "would exceed the strength of previous El Niño events dating back to 1950 (+2.5°C or more)"

NOAA CPC, seasonal outlook discussion, 20 Aug 2026
- above-normal precipitation odds "increased significantly to above 50 percent across much of coastal California and adjacent areas of southern Arizona from DJF through FMA, peaking in coverage during JFM."

@Just_Curius on X, 11 Sep 2026, https://x.com/Just_Curius/status/2098592816028954706
- "California is likely to see anywhere from extra precipitation & storm surge to a megastorm and a megaflood this winter (~2.5% chance)."

## Data (output of scripts/elnino_estimates.py, 2026-09-11)

## Analog winters: peak RONI >= 1.5 (NOAA CPC table)

1957-58 (1.9), 1965-66 (2.0), 1972-73 (2.0), 1982-83 (2.4), 1986-87 (1.5), 1991-92 (2.1), 1997-98 (2.3), 2009-10 (1.5), 2015-16 (2.3) 

## Dec-Feb statewide precipitation, 131 winters (1896-2026)

median 10.8 in · top-20% threshold 15.1 in · max 23.3 in

| Strong El Niño winter | peak RONI | Dec-Feb inches | rank of 131 | top 20%? |
|---|---|---|---|---|
| 1957-58 | 1.9 | 16.6 | 22 | yes |
| 1965-66 | 2.0 | 9.0 | 89 | no |
| 1972-73 | 2.0 | 14.4 | 33 | no |
| 1982-83 | 2.4 | 17.6 | 14 | yes |
| 1986-87 | 1.5 | 7.3 | 106 | no |
| 1991-92 | 2.1 | 10.4 | 73 | no |
| 1997-98 | 2.3 | 21.4 | 3 | yes |
| 2009-10 | 1.5 | 13.3 | 39 | no |
| 2015-16 | 2.3 | 12.3 | 50 | no |

Top-20% winters among the 9 analogs: 3/9 = 33%. Above-median: 6/9 = 67%.

## Megastorm month: any Nov-Mar calendar month with >= 9 in statewide

Winters that had one: 1908-09 (12.3), 1910-11 (10.1), 1913-14 (10.6), 1915-16 (11.0), 1955-56 (10.7), 1968-69 (10.8), 1982-83 (9.0), 1985-86 (9.3), 1990-91 (9.1), 1994-95 (12.5), 1997-98 (11.5), 2016-17 (9.9)

Base rate: 12/131 winters = 9.2%
Given a top-20% Dec-Feb: 10/27 = 37%; otherwise 2/104 = 1.9%
Strong El Niño analogs: 2/9 = 1982-83, 1997-98

Record calendar month: 12.50 in (199501); chance a stationary 131-year record is beaten next year ≈ 1/132 = 0.76%

## Coastal flooding: Los Angeles tide gauge 9410660, Nov-Apr days at/above NOS minor flood level

>= 1 days: 24/72 winters since 1950 = 33%; last 11 winters: 5/11
>= 3 days: 7/72 winters since 1950 = 10%; last 11 winters: 3/11
>= 5 days: 3/72 winters since 1950 = 4%; last 11 winters: 2/11

Strong El Niño analogs (days): 1957-58: 0, 1965-66: n/a, 1972-73: 1, 1982-83: 6, 1986-87: 2, 1991-92: 2, 1997-98: 3, 2009-10: 1, 2015-16: 5
Last 11 winters (days): 2015-16: 5, 2016-17: 0, 2017-18: 0, 2018-19: 0, 2019-20: 3, 2020-21: 0, 2021-22: 2, 2022-23: 1, 2023-24: 0, 2024-25: 0, 2025-26: 6

## Sources

- NOAA NCEI Climate at a Glance, California statewide precipitation:
  https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/statewide/time-series/4/pcp/3/2/1895-2026
- NOAA CO-OPS high tide flooding, Los Angeles 9410660:
  https://tidesandcurrents.noaa.gov/high-tide-flooding/ and
  https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/9410660/floodlevels.json
- NOAA CPC RONI table: https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/
- NOAA CPC ENSO discussion, 10 Sep 2026:
  https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml
- NOAA CPC seasonal outlook discussion, 20 Aug 2026:
  https://www.cpc.ncep.noaa.gov/products/predictions/long_range/fxus05.html
- Daniel Swain on the ECMWF August ensemble:
  https://x.com/Weather_West/status/2085473752268021774
- NOAA Ocean Service, El Niño and high tide flooding (May 2026):
  https://oceanservice.noaa.gov/news/may26/el-nino-flooding.html
- Huang & Swain 2022, Science Advances: https://www.science.org/doi/10.1126/sciadv.abq0995
  and the Weather West summary: https://weatherwest.com/archives/16626
