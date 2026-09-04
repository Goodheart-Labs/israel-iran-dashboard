import { z } from "zod";

const point = z.object({
  date: z.string().refine((s) => Number.isFinite(Date.parse(s))),
  value: z.number().finite(),
  range: z.tuple([z.number().finite(), z.number().finite()]).optional(),
});
export const agiDashboardSchema = z.object({
  generatedAt: z.string(),
  unavailableSources: z.array(z.string()).default([]),
  index: z.array(point).min(1),
  sources: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string(),
      kind: z.enum(["year", "probability"]),
      url: z.string().url(),
      definition: z.string(),
      points: z.array(point),
    }),
  ),
});
export type AgiPoint = z.infer<typeof point>;
export type AgiSource = z.infer<typeof agiDashboardSchema>["sources"][number];

export async function fetchAgiDashboard(signal?: AbortSignal) {
  const endpoint =
    import.meta.env.VITE_AGI_DATA_URL ||
    "https://agi.goodheartlabs.com/api/dashboard";
  const response = await fetch(endpoint, { signal });
  if (!response.ok)
    throw new Error("AGI forecasts are temporarily unavailable");
  return agiDashboardSchema.parse(await response.json());
}

export function agiChartRows(sources: Pick<AgiSource, "id" | "points">[]) {
  const rows = new Map<number, Record<string, number | [number, number]>>();
  for (const source of sources)
    for (const point of source.points) {
      const t = Date.parse(point.date);
      const row = rows.get(t) ?? { t };
      row[source.id] = point.value;
      if (point.range) row[`${source.id}-range`] = point.range;
      rows.set(t, row);
    }
  return [...rows.values()].sort((a, b) => Number(a.t) - Number(b.t));
}
