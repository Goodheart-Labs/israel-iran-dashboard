#!/usr/bin/env python3
"""Base rates behind the "California this winter" tiles on /elnino.

Downloads public data and prints the numbers the page quotes, so anyone can
re-run it:  python3 scripts/elnino_estimates.py

Sources
- NOAA NCEI Climate at a Glance, California statewide precipitation (nClimDiv),
  Dec-Feb totals and calendar months, 1895-present.
- NOAA CO-OPS high tide flooding monthly counts (days at/above the NOS minor
  flood level) for the Los Angeles tide gauge, station 9410660.
- NOAA CPC Relative Oceanic Nino Index (RONI) table, for the analog winters.

Only the standard library is used.
"""
import csv, io, json, re, html, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (globalriskodds.com estimates script)"}
CAG = "https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance/statewide/time-series/4/pcp/{months}/{end}/1895-2026/data.csv"
HTF = "https://api.tidesandcurrents.noaa.gov/dpapi/prod/webapi/htf/htf_monthly.json?station={station}"
RONI = "https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/"
LA = "9410660"


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read().decode("utf-8", "ignore")


def cag(months, end):
    rows = [r for r in csv.reader(io.StringIO(get(CAG.format(months=months, end=end)))) if r and r[0][:1].isdigit()]
    return {int(r[0]): float(r[1]) for r in rows if r[1] not in ("-99", "-9999")}


def percentile(sorted_vals, p):
    k = (len(sorted_vals) - 1) * p
    f = int(k)
    return sorted_vals[f] + (sorted_vals[min(f + 1, len(sorted_vals) - 1)] - sorted_vals[f]) * (k - f)


def roni_winters():
    """Winter -> peak 3-month RONI from Jul of that year to Feb of the next."""
    text = html.unescape(re.sub(r"<[^>]+>", " ", get(RONI)))
    rows = re.findall(r"\b(19[5-9]\d|20[0-2]\d)\s+((?:-?\d\.\d\s+){6,12})", text)
    table = {int(y): [float(x) for x in v.split()] for y, v in rows}
    peaks = {}
    for y in sorted(table):
        if y + 1 in table and len(table[y]) >= 12 and len(table[y + 1]) >= 2:
            peaks[y] = max(table[y][6:12] + table[y + 1][0:2])  # JJA..NDJ, DJF, JFM
    return peaks


def main():
    djf = cag(3, 2)      # keyed YYYY02 = winter ending that year
    monthly = cag(1, 0)  # keyed YYYYMM
    peaks = roni_winters()
    strong = {y: p for y, p in peaks.items() if p >= 1.5}
    print("## Analog winters: peak RONI >= 1.5 (NOAA CPC table)\n")
    print(", ".join(f"{y}-{str(y+1)[2:]} ({p})" for y, p in sorted(strong.items())), "\n")

    # --- Tile 1: very wet winter (Dec-Feb statewide precipitation, top 20%) ---
    vals = sorted(djf.values())
    p80, med = percentile(vals, 0.8), percentile(vals, 0.5)
    print(f"## Dec-Feb statewide precipitation, {len(vals)} winters ({min(djf)//100}-{max(djf)//100})\n")
    print(f"median {med:.1f} in · top-20% threshold {p80:.1f} in · max {vals[-1]:.1f} in\n")
    print("| Strong El Niño winter | peak RONI | Dec-Feb inches | rank of {n} | top 20%? |".format(n=len(vals)))
    print("|---|---|---|---|---|")
    hits = above = 0
    for y, p in sorted(strong.items()):
        v = djf.get((y + 1) * 100 + 2)
        if v is None:
            continue
        rank = sum(1 for x in vals if x > v) + 1
        hits += v >= p80
        above += v >= med
        print(f"| {y}-{str(y+1)[2:]} | {p} | {v:.1f} | {rank} | {'yes' if v >= p80 else 'no'} |")
    n = len(strong)
    print(f"\nTop-20% winters among the {n} analogs: {hits}/{n} = {100*hits/n:.0f}%. Above-median: {above}/{n} = {100*above/n:.0f}%.\n")

    # --- Tile 3: megastorm month (a Nov-Mar calendar month >= 9 in statewide) ---
    def winter_max(y):
        ks = [y * 100 + 11, y * 100 + 12, (y + 1) * 100 + 1, (y + 1) * 100 + 2, (y + 1) * 100 + 3]
        xs = [monthly[k] for k in ks if k in monthly]
        return max(xs) if len(xs) == 5 else None

    W = {y: (djf.get((y + 1) * 100 + 2), winter_max(y)) for y in range(1895, 2026)}
    W = {y: v for y, v in W.items() if None not in v}
    THR = 9.0
    all_hits = [y for y, (d, m) in W.items() if m >= THR]
    top = [y for y, (d, m) in W.items() if d >= p80]
    top_hits = [y for y in top if W[y][1] >= THR]
    rest = [y for y in W if y not in top]
    rest_hits = [y for y in rest if W[y][1] >= THR]
    print(f"## Megastorm month: any Nov-Mar calendar month with >= {THR:.0f} in statewide\n")
    print("Winters that had one: " + ", ".join(f"{y}-{str(y+1)[2:]} ({W[y][1]:.1f})" for y in all_hits) + "\n")
    print(f"Base rate: {len(all_hits)}/{len(W)} winters = {100*len(all_hits)/len(W):.1f}%")
    print(f"Given a top-20% Dec-Feb: {len(top_hits)}/{len(top)} = {100*len(top_hits)/len(top):.0f}%; otherwise {len(rest_hits)}/{len(rest)} = {100*len(rest_hits)/len(rest):.1f}%")
    s_hits = [y for y in strong if y in W and W[y][1] >= THR]
    print(f"Strong El Niño analogs: {len(s_hits)}/{len([y for y in strong if y in W])} = " + ", ".join(f"{y}-{str(y+1)[2:]}" for y in s_hits) + "\n")
    print(f"Record calendar month: {max(monthly.values()):.2f} in (" + str(max(monthly, key=monthly.get)) + f"); chance a stationary {len(W)}-year record is beaten next year ≈ 1/{len(W)+1} = {100/(len(W)+1):.2f}%\n")

    # --- Tile 2: coastal flooding (LA gauge, days at/above NOS minor level, Nov-Apr) ---
    rows = json.loads(get(HTF.format(station=LA))).get("MonthlyFloodCount", [])
    m = {(r["year"], r["month"]): r for r in rows}
    years = sorted({r["year"] for r in rows})
    win = {}
    for y in range(years[0], years[-1]):
        ks = [(y, 11), (y, 12), (y + 1, 1), (y + 1, 2), (y + 1, 3), (y + 1, 4)]
        if all(k in m and (m[k]["percent_completeness"] or 0) >= 80 for k in ks):
            win[y] = sum((m[k]["minCount"] or 0) + (m[k]["modCount"] or 0) + (m[k]["majCount"] or 0) for k in ks)
    since = sorted(y for y in win if y >= 1950)
    print("## Coastal flooding: Los Angeles tide gauge 9410660, Nov-Apr days at/above NOS minor flood level\n")
    for t in (1, 3, 5):
        ge = [y for y in since if win[y] >= t]
        print(f">= {t} days: {len(ge)}/{len(since)} winters since 1950 = {100*len(ge)/len(since):.0f}%; last 11 winters: {len([y for y in since[-11:] if win[y] >= t])}/11")
    print("\nStrong El Niño analogs (days): " + ", ".join(f"{y}-{str(y+1)[2:]}: {win.get(y, 'n/a')}" for y in sorted(strong)))
    print("Last 11 winters (days): " + ", ".join(f"{y}-{str(y+1)[2:]}: {win[y]}" for y in since[-11:]))


if __name__ == "__main__":
    main()
