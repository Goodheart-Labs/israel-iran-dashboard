// Turn cumulative "P(IPO by date)" market data into a single forecast day:
// the market-implied median date, linearly interpolated between known points.

export type CumulativePoint = { date: Date; p: number };

// Points must represent a cumulative distribution. Ladders stitched from
// separate markets can dip slightly; enforce a running max before use.
export function medianDayFromCumulative(
  points: CumulativePoint[],
): Date | null {
  const sorted = [...points].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );
  let runningMax = 0;
  const monotonic = sorted.map(({ date, p }) => {
    runningMax = Math.max(runningMax, p);
    return { date, p: runningMax };
  });

  const crossIndex = monotonic.findIndex((point) => point.p >= 0.5);
  if (crossIndex === -1) return null;
  if (crossIndex === 0) return monotonic[0].date;

  const prev = monotonic[crossIndex - 1];
  const next = monotonic[crossIndex];
  if (next.p === prev.p) return next.date;
  const t = (0.5 - prev.p) / (next.p - prev.p);
  return new Date(
    prev.date.getTime() + t * (next.date.getTime() - prev.date.getTime()),
  );
}

const QUARTER_END: Record<string, string> = {
  Q1: "03-31",
  Q2: "06-30",
  Q3: "09-30",
  Q4: "12-31",
};

const MONTH_NUM: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

// "2026 Q4" -> Dec 31 2026. Null for unparseable buckets.
export function quarterBucketEnd(text: string): Date | null {
  const match = text.match(/^(\d{4}) (Q[1-4])$/);
  if (!match) return null;
  return new Date(`${match[1]}-${QUARTER_END[match[2]]}T23:59:00`);
}

// "October 2026" / "September 2026 or earlier" -> end of that month.
// Open-ended "or later" buckets return null (no finite end date).
export function monthBucketEnd(text: string): Date | null {
  if (/or later/i.test(text)) return null;
  const match = text.match(/^(\w+) (\d{4})/);
  if (!match) return null;
  const monthNum = MONTH_NUM[match[1]];
  if (!monthNum) return null;
  const lastDay = new Date(Number(match[2]), monthNum, 0).getDate();
  return new Date(
    `${match[2]}-${String(monthNum).padStart(2, "0")}-${lastDay}T23:59:00`,
  );
}

// A probability distribution over date buckets -> cumulative points at each
// finite bucket end. Buckets without a parseable end (e.g. "June 2027 or
// later") still count toward the running sum order but produce no point, so a
// median falling inside one comes back null from medianDayFromCumulative.
export function distributionToCumulative(
  buckets: { text: string; probability: number }[],
  parseEnd: (text: string) => Date | null,
): CumulativePoint[] {
  const points: CumulativePoint[] = [];
  let cumulative = 0;
  for (const bucket of buckets) {
    cumulative += bucket.probability;
    const end = parseEnd(bucket.text);
    if (end) points.push({ date: end, p: cumulative });
  }
  return points;
}

// Average several source medians into one headline day.
export function averageDays(days: (Date | null)[]): Date | null {
  const valid = days.filter((d): d is Date => d !== null);
  if (valid.length === 0) return null;
  const mean = valid.reduce((sum, d) => sum + d.getTime(), 0) / valid.length;
  return new Date(mean);
}

const DAY_MS = 86_400_000;

export type LagBucket = { days: number; weight: number };

/**
 * Convert an event-date CDF into a later event-date CDF by convolving it with
 * a discrete lag distribution. Values before the source curve are zero; after
 * its final rung, the final known cumulative probability is carried forward.
 */
export function applyLagDistribution(
  curve: CumulativePoint[],
  lagBuckets: LagBucket[],
): CumulativePoint[] {
  const points = [...curve]
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map(({ date, p }) => ({ t: date.getTime(), p }));
  const totalWeight = lagBuckets.reduce(
    (sum, bucket) => sum + bucket.weight,
    0,
  );
  if (points.length < 2 || totalWeight <= 0) return curve;

  let runningMax = 0;
  for (const point of points) {
    runningMax = Math.max(runningMax, point.p);
    point.p = runningMax;
  }

  const cdfAt = (t: number): number => {
    if (t < points[0].t) return 0;
    if (t >= points[points.length - 1].t) return points[points.length - 1].p;
    let i = 1;
    while (points[i].t < t) i++;
    const a = points[i - 1];
    const b = points[i];
    return a.p + ((t - a.t) / (b.t - a.t)) * (b.p - a.p);
  };

  const minLag = Math.min(...lagBuckets.map((bucket) => bucket.days));
  const maxLag = Math.max(...lagBuckets.map((bucket) => bucket.days));
  const start = points[0].t + minLag * DAY_MS;
  const end = points[points.length - 1].t + maxLag * DAY_MS;
  const adjusted: CumulativePoint[] = [];

  for (let t = start; t <= end; t += DAY_MS) {
    const p =
      lagBuckets.reduce(
        (sum, bucket) => sum + bucket.weight * cdfAt(t - bucket.days * DAY_MS),
        0,
      ) / totalWeight;
    adjusted.push({ date: new Date(t), p });
  }
  return adjusted;
}

// Convert a cumulative curve into a monthly probability distribution:
// P(event lands in the month ending at each date), linearly interpolating the
// cumulative curve at month-ends. Only months inside the curve's data window
// are returned, so sources with short horizons simply produce short series.
export function monthlyDistribution(
  curve: CumulativePoint[],
): { date: Date; p: number }[] {
  const sorted = [...curve].sort((a, b) => a.date.getTime() - b.date.getTime());
  let runningMax = 0;
  const points = sorted.map(({ date, p }) => {
    runningMax = Math.max(runningMax, p);
    return { t: date.getTime(), p: runningMax };
  });
  if (points.length < 2) return [];

  const cumAt = (t: number): number => {
    let i = 1;
    while (i < points.length && points[i].t < t) i++;
    const a = points[i - 1];
    const b = points[Math.min(i, points.length - 1)];
    return b.t === a.t ? a.p : a.p + ((t - a.t) / (b.t - a.t)) * (b.p - a.p);
  };

  const first = points[0];
  const last = points[points.length - 1];
  const result: { date: Date; p: number }[] = [];
  const firstDate = new Date(first.t);
  let year = firstDate.getFullYear();
  let month = firstDate.getMonth();
  let prevT = first.t;
  for (;;) {
    // End of the current month, 23:59 local — matches rung conventions.
    const monthEnd = new Date(year, month + 1, 0, 23, 59).getTime();
    if (monthEnd > last.t + DAY_MS) break;
    if (monthEnd > prevT) {
      result.push({
        date: new Date(monthEnd),
        p: Math.max(0, cumAt(monthEnd) - cumAt(prevT)),
      });
      prevT = monthEnd;
    }
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
  }
  return result;
}

// Blend several sources' monthly distributions into one, equal weight,
// bucket-wise — the AGI index's approach. Only sources whose data covers a
// given month contribute to that month's average, so a short-horizon source
// drops out rather than dragging the blend to zero.
export function blendedMonthlyDistribution(
  curves: CumulativePoint[][],
): { date: Date; p: number }[] {
  const byMonth = new Map<number, number[]>();
  for (const curve of curves) {
    for (const { date, p } of monthlyDistribution(curve)) {
      const key = date.getTime();
      const bucket = byMonth.get(key) ?? [];
      bucket.push(p);
      byMonth.set(key, bucket);
    }
  }
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, values]) => ({
      date: new Date(time),
      p: values.reduce((sum, v) => sum + v, 0) / values.length,
    }));
}

// Blend several cumulative curves (equal weight) and read the median off the
// blend — the same shape as the AGI dashboard's index: combine distributions
// first, then take the midpoint, rather than averaging per-source medians.
// At each sampled day, only curves whose data covers that day participate;
// outside its first/last point a curve simply drops out of the average.
export function blendedMedianDay(curves: CumulativePoint[][]): Date | null {
  const valid = curves
    .map((curve) => {
      const sorted = [...curve].sort(
        (a, b) => a.date.getTime() - b.date.getTime(),
      );
      let runningMax = 0;
      return sorted.map(({ date, p }) => {
        runningMax = Math.max(runningMax, p);
        return { t: date.getTime(), p: runningMax };
      });
    })
    .filter((curve) => curve.length >= 2);
  if (valid.length === 0) return null;

  const start = Math.min(...valid.map((c) => c[0].t));
  const end = Math.max(...valid.map((c) => c[c.length - 1].t));

  let prev: { t: number; p: number } | null = null;
  for (let t = start; t <= end; t += DAY_MS) {
    const values: number[] = [];
    for (const curve of valid) {
      if (t < curve[0].t || t > curve[curve.length - 1].t) continue;
      let i = 1;
      while (i < curve.length && curve[i].t < t) i++;
      const a = curve[i - 1];
      const b = curve[Math.min(i, curve.length - 1)];
      values.push(
        b.t === a.t ? a.p : a.p + ((t - a.t) / (b.t - a.t)) * (b.p - a.p),
      );
    }
    if (values.length === 0) continue;
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
    if (avg >= 0.5) {
      if (!prev) return new Date(t);
      const frac = (0.5 - prev.p) / (avg - prev.p);
      return new Date(prev.t + frac * (t - prev.t));
    }
    prev = { t, p: avg };
  }
  return null;
}

const WEEK_MS = 7 * DAY_MS;

/**
 * How a ladder's implied date has moved over time.
 *
 * Each rung is a separate market with its own price history. Sampling weekly,
 * we rebuild that day's whole cumulative curve from the rungs and read the
 * date it implied — so this is the same blend-then-read method as the
 * headline, run backwards through history.
 */
export function impliedDateSeries(
  rungs: {
    resolveDate: number;
    history: Array<{ timestamp: number; probability: number }>;
  }[],
): { t: number; impliedT: number }[] {
  const usable = rungs.filter((r) => r.history.length > 0);
  if (usable.length === 0) return [];

  const start = Math.max(...usable.map((r) => r.history[0].timestamp));
  const end = Math.max(
    ...usable.map((r) => r.history[r.history.length - 1].timestamp),
  );
  if (!Number.isFinite(start) || end <= start) return [];

  const out: { t: number; impliedT: number }[] = [];
  for (let t = start; t <= end; t += WEEK_MS) {
    const points: CumulativePoint[] = [];
    for (const rung of usable) {
      // Last price at or before t — prices are step functions, not lines.
      let value: number | null = null;
      for (const point of rung.history) {
        if (point.timestamp > t) break;
        value = point.probability;
      }
      if (value == null) continue;
      points.push({ date: new Date(rung.resolveDate), p: value / 100 });
    }
    if (points.length < 2) continue;
    const median = medianDayFromCumulative(points);
    if (median) out.push({ t, impliedT: median.getTime() });
  }
  return out;
}

/**
 * How the blended forecast's implied date has moved.
 *
 * Sources publish history in different shapes: Polymarket gives a full ladder
 * per day (so its implied date is read off that day's curve), while Metaculus
 * publishes only its community centre. Where both exist we average their
 * implied dates; before a source starts, the blend is whatever else is there.
 */
export function blendImpliedSeries(
  seriesList: { t: number; impliedT: number }[][],
): { t: number; impliedT: number }[] {
  const usable = seriesList.filter((s) => s.length > 0);
  if (usable.length === 0) return [];

  const times = Array.from(
    new Set(usable.flatMap((s) => s.map((p) => p.t))),
  ).sort((a, b) => a - b);

  const out: { t: number; impliedT: number }[] = [];
  for (const t of times) {
    const values: number[] = [];
    for (const series of usable) {
      // Last known value at or before t — forecasts persist until revised.
      let value: number | null = null;
      for (const point of series) {
        if (point.t > t) break;
        value = point.impliedT;
      }
      if (value != null) values.push(value);
    }
    if (values.length === 0) continue;
    out.push({
      t,
      impliedT: values.reduce((sum, v) => sum + v, 0) / values.length,
    });
  }
  return out;
}
