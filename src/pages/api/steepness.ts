// Section F4: Curve Steepness (10Y − 2Y)
// Germany removed: no daily 2Y data available via any free API.
// Norway 2Y sourced from GOVT_ZEROCOUPON (daily).
// US 2Y and 10Y from FRED (daily).

import type { NextApiRequest, NextApiResponse } from "next";
import { fredSeries, nDaysAgo } from "@/lib/fred";
import { nbFetchYield } from "@/lib/norgesbank";
import { getCache, setCache } from "@/lib/cache";
import { alignByDate } from "@/lib/stats";

const CACHE_KEY = "steepness";

export interface SteepnessEntry {
  country: string;
  current: number | null;
  weekAgo: number | null;
  direction: "steeper" | "flatter" | "unchanged" | "unavailable";
  inverted: boolean;
}

export interface SteepnessResponse {
  entries: SteepnessEntry[];
  updatedAt: string;
}

function direction(current: number | null, weekAgo: number | null): SteepnessEntry["direction"] {
  if (current === null || weekAgo === null) return "unavailable";
  const diff = current - weekAgo;
  if (Math.abs(diff) < 0.01) return "unchanged";
  return diff > 0 ? "steeper" : "flatter";
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SteepnessResponse | { error: string }>
) {
  const cached = getCache<SteepnessResponse>(CACHE_KEY);
  if (cached) return res.status(200).json(cached);

  // ~14 trading days for the "last week" comparison
  const start = nDaysAgo(22);

  try {
    const [us10Raw, us2Raw, no10Raw, no2Raw] = await Promise.all([
      fredSeries("DGS10", start).catch(() => []),
      fredSeries("DGS2",  start).catch(() => []),
      nbFetchYield("10Y", start).catch(() => []),
      nbFetchYield("2Y",  start).catch(() => []),  // GOVT_ZEROCOUPON
    ]);

    const us10 = us10Raw.map((p) => ({ date: p.date, value: parseFloat(p.value) }));
    const us2  = us2Raw.map((p)  => ({ date: p.date, value: parseFloat(p.value) }));
    const no10 = no10Raw.map((p) => ({ date: p.date, value: p.value }));
    const no2  = no2Raw.map((p)  => ({ date: p.date, value: p.value }));

    // US
    const usAligned = alignByDate(us10, us2);
    const usCurrent = usAligned.length ? usAligned[usAligned.length - 1].a - usAligned[usAligned.length - 1].b : null;
    const usWeekAgo = usAligned.length > 5 ? usAligned[usAligned.length - 6].a - usAligned[usAligned.length - 6].b : null;

    // Norway — both from daily sources
    const noAligned = alignByDate(no10, no2);
    const noCurrent = noAligned.length ? noAligned[noAligned.length - 1].a - noAligned[noAligned.length - 1].b : null;
    const noWeekAgo = noAligned.length > 5 ? noAligned[noAligned.length - 6].a - noAligned[noAligned.length - 6].b : null;

    const round2 = (v: number | null) => v !== null ? parseFloat(v.toFixed(2)) : null;

    const entries: SteepnessEntry[] = [
      {
        country: "Norway",
        current: round2(noCurrent),
        weekAgo: round2(noWeekAgo),
        direction: direction(noCurrent, noWeekAgo),
        inverted: noCurrent !== null && noCurrent < 0,
      },
      {
        country: "United States",
        current: round2(usCurrent),
        weekAgo: round2(usWeekAgo),
        direction: direction(usCurrent, usWeekAgo),
        inverted: usCurrent !== null && usCurrent < 0,
      },
    ];

    const result: SteepnessResponse = { entries, updatedAt: new Date().toISOString() };
    setCache(CACHE_KEY, result);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
