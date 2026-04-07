// Section F6: Rolling Correlation
// Germany removed: IRLTLT01DEM156N is monthly. Aligning monthly with daily data
// produces ~24 matched dates over 2 years — far too sparse for 30d or 90d rolling windows.
// We now show only NO 10Y vs US 10Y (both daily, robust result).

import type { NextApiRequest, NextApiResponse } from "next";
import { fredSeries, nDaysAgo } from "@/lib/fred";
import { nbFetchYield } from "@/lib/norgesbank";
import { getCache, setCache } from "@/lib/cache";
import { alignByDate, rollingCorrelation } from "@/lib/stats";

const CACHE_KEY = "correlation";

export interface CorrelationPoint {
  date: string;
  noUsCorr: number | null;
}

export interface CorrelationResponse {
  data30d: CorrelationPoint[];
  data90d: CorrelationPoint[];
  updatedAt: string;
  note: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CorrelationResponse | { error: string }>
) {
  const cached = getCache<CorrelationResponse>(CACHE_KEY);
  if (cached) return res.status(200).json(cached);

  // Need 2 years + 90d window buffer
  const start = nDaysAgo(365 * 2 + 120);

  try {
    const [usRaw, noRaw] = await Promise.all([
      fredSeries("DGS10", start).catch(() => []),
      nbFetchYield("10Y", start).catch(() => []),
    ]);

    const us = usRaw.map((p) => ({ date: p.date, value: parseFloat(p.value) }));
    const no = noRaw.map((p) => ({ date: p.date, value: p.value }));

    // Align by date (both daily — robust alignment)
    const aligned = alignByDate(no, us);

    if (aligned.length < 30) {
      return res.status(200).json({
        data30d: [], data90d: [],
        updatedAt: new Date().toISOString(),
        note: "Insufficient data",
      });
    }

    const noVals = aligned.map((p) => p.a);
    const usVals = aligned.map((p) => p.b);

    const buildSeries = (window: number): CorrelationPoint[] => {
      const corrs = rollingCorrelation(noVals, usVals, window);
      return aligned.map((p, i) => ({
        date: p.date,
        noUsCorr: corrs[i] !== null ? parseFloat(corrs[i]!.toFixed(3)) : null,
      }));
    };

    const cutoff = nDaysAgo(365 * 2);
    const trim = (pts: CorrelationPoint[]) => pts.filter((p) => p.date >= cutoff);

    const result: CorrelationResponse = {
      data30d: trim(buildSeries(30)),
      data90d: trim(buildSeries(90)),
      updatedAt: new Date().toISOString(),
      note: "Germany excluded: monthly frequency (FRED IRLTLT01DEM156N) is incompatible with 30d/90d rolling windows on daily data.",
    };

    setCache(CACHE_KEY, result);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
