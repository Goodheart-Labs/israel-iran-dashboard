/**
 * Convert a 0-1 position on a Metaculus question's range to a timestamp.
 *
 * Some date questions are log-scaled — they carry a zero_point, and spacing
 * compresses towards the near end. Mapping those linearly is badly wrong, not
 * slightly: the weak-AGI question's community centre reads as 2028 under log
 * scaling and 2120 under linear.
 */
export function scaleToTimestamp(
  value01: number,
  rangeMin: number,
  rangeMax: number,
  zeroPoint?: number | null,
): number {
  if (zeroPoint == null) {
    return rangeMin + (rangeMax - rangeMin) * value01;
  }
  const ratio = (rangeMax - zeroPoint) / (rangeMin - zeroPoint);
  return zeroPoint + (rangeMin - zeroPoint) * Math.pow(ratio, value01);
}
