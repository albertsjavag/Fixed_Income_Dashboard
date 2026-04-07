// Spread Calculator API — serves the interactive F9 section
// Norway data now uses the correct GOVT_GENERIC_RATES / GOVT_ZEROCOUPON API.

import type { NextApiRequest, NextApiResponse } from "next";
import { fredSeries, nDaysAgo } from "@/lib/fred";
import { nbFetchYield } from "@/lib/norgesbank";
import { getCache, setCache } from "@/lib/cache";

const FRED_MAP: Record<string, string> = {
  US_3M:  "DGS3MO",
  US_6M:  "DGS6MO",
  US_1Y:  "DGS1",
  US_2Y:  "DGS2",
  US_5Y:  "DGS5",
  US_10Y: "DGS10",
  DE_10Y: "IRLTLT01DEM156N",
};

const NB_MAP: Record<string, Parameters<typeof nbFetchYield>[0]> = {
  NO_3M:  "3M",
  NO_6M:  "6M",
  NO_1Y:  "1Y",
  NO_2Y:  "2Y",
  NO_5Y:  "5Y",
  NO_10Y: "10Y",
};

export const ALL_SERIES = [
  { id: "US_3M",   label: "US  3M",  group: "US" },
  { id: "US_6M",   label: "US  6M",  group: "US" },
  { id: "US_1Y",   label: "US  1Y",  group: "US" },
  { id: "US_2Y",   label: "US  2Y",  group: "US" },
  { id: "US_5Y",   label: "US  5Y",  group: "US" },
  { id: "US_10Y",  label: "US 10Y",  group: "US" },
  { id: "NO_3M",   label: "NO  3M",  group: "NO" },
  { id: "NO_6M",   label: "NO  6M",  group: "NO" },
  { id: "NO_1Y",   label: "NO  1Y",  group: "NO" },
  { id: "NO_2Y",   label: "NO  2Y",  group: "NO" },
  { id: "NO_5Y",   label: "NO  5Y",  group: "NO" },
  { id: "NO_10Y",  label: "NO 10Y",  group: "NO" },
  { id: "DE_10Y",  label: "DE 10Y",  group: "DE" },
];

async function fetchSeries(id: string, start: string): Promise<{ date: string; value: number }[]> {
  if (FRED_MAP[id]) {
    const raw = await fredSeries(FRED_MAP[id], start);
    return raw.map((o) => ({ date: o.date, value: parseFloat(o.value) }));
  }
  if (NB_MAP[id]) {
    const pts = await nbFetchYield(NB_MAP[id], start);
    return pts.map((p) => ({ date: p.date, value: p.value }));
  }
  throw new Error(`Unknown series ID: ${id}`);
}

export interface SeriesDataPoint {
  date: string;
  a: number | null;
  b: number | null;
  spread: number | null;
}

export interface SeriesDataResponse {
  points: SeriesDataPoint[];
  labelA: string;
  labelB: string;
  currentA: number | null;
  currentB: number | null;
  currentSpread: number | null;
  updatedAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SeriesDataResponse | { error: string }>
) {
  const { a, b, days = "730" } = req.query;
  if (!a || !b || typeof a !== "string" || typeof b !== "string") {
    return res.status(400).json({ error: "?a=<seriesId>&b=<seriesId> required" });
  }

  const cacheKey = `series-data:${a}:${b}:${days}`;
  const cached = getCache<SeriesDataResponse>(cacheKey);
  if (cached) return res.status(200).json(cached);

  const daysN = parseInt(typeof days === "string" ? days : "730", 10);
  const start = nDaysAgo(daysN + 60);

  const labelA = ALL_SERIES.find((s) => s.id === a)?.label ?? a;
  const labelB = ALL_SERIES.find((s) => s.id === b)?.label ?? b;

  try {
    const [seriesA, seriesB] = await Promise.all([
      fetchSeries(a, start).catch(() => []),
      fetchSeries(b, start).catch(() => []),
    ]);

    const mapA = new Map(seriesA.map((p) => [p.date, p.value]));
    const mapB = new Map(seriesB.map((p) => [p.date, p.value]));

    const dateSet = new Set<string>();
    seriesA.forEach((p) => dateSet.add(p.date));
    seriesB.forEach((p) => dateSet.add(p.date));

    const cutoff = nDaysAgo(daysN);
    const points: SeriesDataPoint[] = Array.from(dateSet)
      .sort()
      .filter((d) => d >= cutoff)
      .map((date) => {
        const av = mapA.get(date) ?? null;
        const bv = mapB.get(date) ?? null;
        return {
          date,
          a: av,
          b: bv,
          spread: av !== null && bv !== null ? parseFloat((av - bv).toFixed(3)) : null,
        };
      });

    const last = [...points].reverse().find((p) => p.a !== null && p.b !== null);
    const result: SeriesDataResponse = {
      points,
      labelA,
      labelB,
      currentA: last?.a ?? null,
      currentB: last?.b ?? null,
      currentSpread: last?.spread ?? null,
      updatedAt: new Date().toISOString(),
    };

    setCache(cacheKey, result);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
