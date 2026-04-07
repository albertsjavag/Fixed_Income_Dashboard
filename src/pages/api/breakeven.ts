// Section 7: Breakeven Inflation
// US: T10YIE (10Y breakeven inflation, FRED)
// Germany: DFII10 is US real yield — for Germany, ECB data is not available without subscription.
//   We'll note this in the UI. We can use FRED BAMLHE00EHYIEY as a proxy check,
//   but cleanest is to use T10YIEM (if exists) — actually for Germany we'll note limitation.
// Norway: Norges Bank publishes inflation expectations surveys, not daily market breakevens.
//   No daily Norwegian breakeven series available — we note this clearly.

import type { NextApiRequest, NextApiResponse } from "next";
import { fredSeries, fredLatest, nDaysAgo } from "@/lib/fred";
import { getCache, setCache } from "@/lib/cache";

const CACHE_KEY = "breakeven";

export interface BreakevenPoint {
  date: string;
  us: number | null;
}

export interface BreakevenResponse {
  data: BreakevenPoint[];
  currentUS: number | null;
  currentUSDate: string | null;
  usAboveTarget: boolean | null;
  norwayNote: string;
  germanyNote: string;
  updatedAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BreakevenResponse | { error: string }>
) {
  const cached = getCache<BreakevenResponse>(CACHE_KEY);
  if (cached) return res.status(200).json(cached);

  const start = nDaysAgo(365 * 2 + 30);

  try {
    const [usRaw, usLatest] = await Promise.all([
      fredSeries("T10YIE", start).catch(() => []),
      fredLatest("T10YIE").catch(() => null),
    ]);

    const data: BreakevenPoint[] = usRaw.map((p) => ({
      date: p.date,
      us: parseFloat(p.value),
    }));

    const result: BreakevenResponse = {
      data,
      currentUS: usLatest?.value ?? null,
      currentUSDate: usLatest?.date ?? null,
      usAboveTarget: usLatest ? usLatest.value > 2.0 : null,
      norwayNote:
        "Norwegian breakeven inflation: Norges Bank does not publish daily market-implied breakeven rates. Inflation-linked government bonds (NGB-IL) are thinly traded and not available via public API.",
      germanyNote:
        "German breakeven inflation: ECB real yield data requires institutional access. No free daily series is available via FRED for German inflation-linked bonds.",
      updatedAt: new Date().toISOString(),
    };

    setCache(CACHE_KEY, result);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
