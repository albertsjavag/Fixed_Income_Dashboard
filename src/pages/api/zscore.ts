// Section F5: Z-Score Indicator
// Norway and US: daily data — z-score based on ~252 observations per year (robust).
// Germany: monthly data — z-score based on ~12 observations per year (flagged in response).

import type { NextApiRequest, NextApiResponse } from "next";
import { fredSeries, nDaysAgo } from "@/lib/fred";
import { nbFetchYield } from "@/lib/norgesbank";
import { getCache, setCache } from "@/lib/cache";
import { zscore, mean, stddev } from "@/lib/stats";

const CACHE_KEY = "zscore";

export interface ZScoreEntry {
  country: string;
  currentYield: number | null;
  zScore: number | null;
  interpretation: "Historically high" | "Historically low" | "Near average" | "Slightly elevated" | "Slightly depressed" | "Unavailable";
  level: "extreme-high" | "elevated" | "normal" | "depressed" | "extreme-low" | "unavailable";
  sparkline: { date: string; z: number }[];
  dataQuality: "daily" | "monthly";
  dataPoints: number;
}

export interface ZScoreResponse {
  entries: ZScoreEntry[];
  updatedAt: string;
}

function interpret(z: number | null): ZScoreEntry["interpretation"] {
  if (z === null) return "Unavailable";
  if (z >= 2)  return "Historically high";
  if (z <= -2) return "Historically low";
  if (z >= 1)  return "Slightly elevated";
  if (z <= -1) return "Slightly depressed";
  return "Near average";
}

function levelOf(z: number | null): ZScoreEntry["level"] {
  if (z === null) return "unavailable";
  if (z >= 2)  return "extreme-high";
  if (z >= 1)  return "elevated";
  if (z <= -2) return "extreme-low";
  if (z <= -1) return "depressed";
  return "normal";
}

function buildEntry(
  country: string,
  vals: { date: string; value: number }[],
  quality: "daily" | "monthly"
): ZScoreEntry {
  if (!vals.length) {
    return { country, currentYield: null, zScore: null, interpretation: "Unavailable",
      level: "unavailable", sparkline: [], dataQuality: quality, dataPoints: 0 };
  }
  const values = vals.map((v) => v.value);
  const m = mean(values);
  const s = stddev(values);
  const current = vals[vals.length - 1].value;
  const z = parseFloat(zscore(current, values).toFixed(2));

  const cutoff90d = nDaysAgo(90);
  const sparkline = vals
    .filter((p) => p.date >= cutoff90d)
    .map((p) => ({ date: p.date, z: parseFloat(((p.value - m) / (s || 1)).toFixed(3)) }));

  return {
    country,
    currentYield: parseFloat(current.toFixed(2)),
    zScore: z,
    interpretation: interpret(z),
    level: levelOf(z),
    sparkline,
    dataQuality: quality,
    dataPoints: vals.length,
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ZScoreResponse | { error: string }>
) {
  const cached = getCache<ZScoreResponse>(CACHE_KEY);
  if (cached) return res.status(200).json(cached);

  const start1y = nDaysAgo(365 + 10);
  const startDE = nDaysAgo(365 * 5); // monthly series — need many years for ~60 monthly points

  try {
    const [usRaw, deRaw, noRaw] = await Promise.all([
      fredSeries("DGS10", start1y).catch(() => []),
      fredSeries("IRLTLT01DEM156N", startDE).catch(() => []),
      nbFetchYield("10Y", start1y).catch(() => []),
    ]);

    const usVals = usRaw.map((p) => ({ date: p.date, value: parseFloat(p.value) }));
    const deVals = deRaw.map((p) => ({ date: p.date, value: parseFloat(p.value) }));
    const noVals = noRaw.map((p) => ({ date: p.date, value: p.value }));

    const entries: ZScoreEntry[] = [
      buildEntry("Norway",        noVals, "daily"),
      buildEntry("Germany",       deVals, "monthly"),
      buildEntry("United States", usVals, "daily"),
    ];

    const result: ZScoreResponse = { entries, updatedAt: new Date().toISOString() };
    setCache(CACHE_KEY, result);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
