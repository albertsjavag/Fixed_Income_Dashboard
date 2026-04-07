// Section F2: 10Y yield history — Norway, Germany, US

import type { NextApiRequest, NextApiResponse } from "next";
import { fredSeries, nDaysAgo } from "@/lib/fred";
import { nbFetchYield } from "@/lib/norgesbank";
import { getCache, setCache } from "@/lib/cache";

const CACHE_KEY = "history-10y";

export interface History10YPoint {
  date: string;
  norway: number | null;
  germany: number | null;
  us: number | null;
}

export interface History10YResponse {
  data: History10YPoint[];
  germanyNote: string;
  updatedAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<History10YResponse | { error: string }>
) {
  const cached = getCache<History10YResponse>(CACHE_KEY);
  if (cached) return res.status(200).json(cached);

  const start = nDaysAgo(365 * 2 + 30);

  try {
    const [usRaw, deRaw, noRaw] = await Promise.all([
      fredSeries("DGS10", start).catch(() => []),
      fredSeries("IRLTLT01DEM156N", start).catch(() => []),
      nbFetchYield("10Y", start).catch(() => []),
    ]);

    const dateSet = new Set<string>();
    usRaw.forEach((p) => dateSet.add(p.date));
    deRaw.forEach((p) => dateSet.add(p.date));
    noRaw.forEach((p) => dateSet.add(p.date));

    const usMap = new Map(usRaw.map((p) => [p.date, parseFloat(p.value)]));
    const deMap = new Map(deRaw.map((p) => [p.date, parseFloat(p.value)]));
    const noMap = new Map(noRaw.map((p) => [p.date, p.value]));

    const data: History10YPoint[] = Array.from(dateSet)
      .sort()
      .map((date) => ({
        date,
        norway:  noMap.get(date) ?? null,
        germany: deMap.get(date) ?? null,
        us:      usMap.get(date) ?? null,
      }));

    const result: History10YResponse = {
      data,
      germanyNote: "Germany 10Y sourced from FRED (IRLTLT01DEM156N) — monthly frequency. Gaps between data points are expected.",
      updatedAt: new Date().toISOString(),
    };
    setCache(CACHE_KEY, result);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
