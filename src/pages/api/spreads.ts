// Section F3: Spread Monitor
// NO 10Y − DE 10Y: removed — DE is monthly, daily alignment produces <30 points/year
//   → replaced with NO 10Y − US 10Y (both daily, directly comparable)
// US 2Y − US 10Y: inversion indicator (FRED daily)
// NO 2Y − NO 10Y: uses GOVT_ZEROCOUPON for 2Y (daily)

import type { NextApiRequest, NextApiResponse } from "next";
import { fredSeries, nDaysAgo } from "@/lib/fred";
import { nbFetchYield } from "@/lib/norgesbank";
import { getCache, setCache } from "@/lib/cache";
import { alignByDate } from "@/lib/stats";

const CACHE_KEY = "spreads";

export interface SpreadPoint {
  date: string;
  noUsSpread: number | null;   // NO 10Y − US 10Y
  usInversion: number | null;  // US 2Y − US 10Y
  noInversion: number | null;  // NO 2Y − NO 10Y  (ZEROCOUPON)
}

export interface SpreadsResponse {
  data: SpreadPoint[];
  updatedAt: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SpreadsResponse | { error: string }>
) {
  const cached = getCache<SpreadsResponse>(CACHE_KEY);
  if (cached) return res.status(200).json(cached);

  const start = nDaysAgo(365 * 2 + 30);

  try {
    const [us10Raw, us2Raw, no10Raw, no2Raw] = await Promise.all([
      fredSeries("DGS10", start).catch(() => []),
      fredSeries("DGS2",  start).catch(() => []),
      nbFetchYield("10Y", start).catch(() => []),
      nbFetchYield("2Y",  start).catch(() => []),   // GOVT_ZEROCOUPON — daily!
    ]);

    const us10 = us10Raw.map((p) => ({ date: p.date, value: parseFloat(p.value) }));
    const us2  = us2Raw.map((p)  => ({ date: p.date, value: parseFloat(p.value) }));
    const no10 = no10Raw.map((p) => ({ date: p.date, value: p.value }));
    const no2  = no2Raw.map((p)  => ({ date: p.date, value: p.value }));

    const noUs   = alignByDate(no10, us10);   // NO 10Y − US 10Y
    const usSprd = alignByDate(us2, us10);    // US 2Y − US 10Y
    const noSprd = alignByDate(no2, no10);    // NO 2Y − NO 10Y

    const dateSet = new Set<string>();
    noUs.forEach((p)   => dateSet.add(p.date));
    usSprd.forEach((p) => dateSet.add(p.date));
    noSprd.forEach((p) => dateSet.add(p.date));

    const noUsMap   = new Map(noUs.map((p)   => [p.date, p.a - p.b]));
    const usSprdMap = new Map(usSprd.map((p) => [p.date, p.a - p.b]));
    const noSprdMap = new Map(noSprd.map((p) => [p.date, p.a - p.b]));

    const data: SpreadPoint[] = Array.from(dateSet)
      .sort()
      .map((date) => ({
        date,
        noUsSpread:  noUsMap.get(date)   ?? null,
        usInversion: usSprdMap.get(date) ?? null,
        noInversion: noSprdMap.get(date) ?? null,
      }));

    const result: SpreadsResponse = { data, updatedAt: new Date().toISOString() };
    setCache(CACHE_KEY, result);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
