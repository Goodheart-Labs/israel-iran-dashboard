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

## Our numbers

### 1. Very wet winter: ~55% (range 35-75%)

Definition: California's Dec-Feb 2026-27 statewide precipitation is at least
15.1 inches, the top 20% of the 131 winters on record (median 10.8 in).

- Base rate: 20% by construction.
- Analogs: 3 of 9 strong El Niño winters (1957-58, 1982-83, 1997-98) = 33%.
  6 of 9 were above the median = 67%.
- ECMWF August seasonal ensemble: 70-100% odds of a top-20% winter across
  California (Daniel Swain's reading of the map, 10 Aug 2026).
- NOAA CPC outlook of 20 Aug 2026: above-normal precipitation odds "increased
  significantly to above 50 percent across much of coastal California" for
  Dec-Feb through Feb-Apr.
- Our number: roughly the midpoint of the analog rate (33%) and the ECMWF
  ensemble (~80%). We lean toward the model because this event is forecast far
  stronger than any analog, and away from it because 2015-16 showed a
  record-class event can still deliver an ordinary winter (12.3 in, rank 50).

### 2. Coastal flooding: ~60% (range 40-80%)

Definition: the Los Angeles tide gauge (NOAA station 9410660) records at least
3 days between Nov 2026 and Apr 2027 at or above NOAA's minor coastal flood
level, 11.18 ft on the station datum = 1.9 ft above mean higher high water.

- Base rate: 7 of 72 winters since 1950 = 10%. Last 11 winters: 3 of 11 = 27%
  (2025-26 had 6 days with no El Niño).
- Analogs: 3 of 8 strong El Niño winters with data = 38% (1982-83: 6 days,
  2015-16: 5, 1997-98: 3). For at least 1 day: 7 of 8.
- Physical lift: El Niño raises seasonal sea level on the US West Coast by
  roughly 6-10 inches (NOAA), a third to a half of the 22-inch margin between
  mean higher high water and the flood level.
- Our number: the analog rate, raised because the two most recent analogs
  both cleared 3 days easily, last winter cleared it with no El Niño at all,
  and this event is forecast to lift the ocean more than any of them.

### 3. Megastorm month: ~20% (range 12-35%)

Definition: some calendar month from Nov 2026 to Mar 2027 delivers at least
9 inches of precipitation averaged over the whole state. Twelve winters in 131
have done it, and they are the storied ones: Dec 1955, Jan 1969, Mar 1983,
Feb 1986, Jan 1995 (the record, 12.5 in), Feb 1998, Jan 2017.

- Base rate: 12 of 131 winters = 9%.
- Analogs: 2 of 9 strong El Niño winters (1982-83, 1997-98) = 22%.
- Conditional on the winter being top-20% wet: 10 of 27 = 37%; otherwise
  2 of 104 = 2%.
- Our number: 0.55 x 37% + 0.45 x 2% = 21%, using tile 1 for the 0.55.

### 4. Megaflood: ~3% (range 1-6%)

Definition: an ARkStorm-scale event, a weeks-long storm sequence whose 30-day
statewide precipitation exceeds anything in the 131-year instrumental record
(the biggest calendar month is 12.5 in, Jan 1995) and approaches the winter of
1861-62. This is the "ARkHist" scenario of ARkStorm 2.0 (Huang & Swain 2022),
which brings slightly less rain than 1862 did.

- Base rate: Huang & Swain put ARkHist at roughly a 1-in-90-to-100-year event
  in the 1995-2005 climate, about 1% a year, and find warming to date has
  already doubled the risk relative to the pre-industrial climate. Instrumental
  cross-check: a stationary 131-year record is beaten in a given year with
  probability about 1/132 = 0.8%.
- El Niño: in their simulations, 7 of the 8 largest 30-day storm sequences
  occurred during moderate-to-strong El Niño conditions, which cover roughly a
  quarter to a third of years, so an El Niño winter carries about 2-3 times
  the average risk. Our own record agrees: 2 of the 9 strong El Niño winters
  produced one of the 12 nine-inch months, versus 12 of 131 overall (2.4x).
- Our number: 1% x 2.5 = 2.5%, rounded up to 3% because this event is
  forecast beyond every analog; the range covers how thin the evidence is.
  The 2.5% figure circulating online sits inside this range but is not a
  published number.

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
