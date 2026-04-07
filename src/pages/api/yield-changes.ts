// Section F8: Yield Change Heatmap
// Norway: uses correct GOVT_GENERIC_RATES / GOVT_ZEROCOUPON API (now daily).
// Germany: monthly series — 1D and 1W changes are always null (can't compute from monthly data).

import type { NextApiRequest, NextApiResponse } from "next";
import { fredSeries, nDaysAgo } from "@/lib/fred";
import { nbFetchYield } from "@/lib/norgesbank";
import { getCache, setCache } from "@/lib/cache";

const CACHE_KEY = "yield-changes";

export interface BondRow {
  id: string;
  label: string;
  current: number | null;
  dataFrequency: "daily" | "monthly";
  changes: {
    "1D": number | null;
    "1W": number | null;
    "1M": number | null;
    "3M": number | null;
    "6M": number | null;
    "1Y": number | null;
  };
}

export interface YieldChangesResponse {
  rows: BondRow[];
  updatedAt: string;
}

function atIndex(s: { date: string; value: number }[], offset: number): number | null {
  const idx = s.length - 1 - offset;
  return idx >= 0 ? s[idx].value : null;
}

function valueAtDate(s: { date: string; value: number }[], target: string): number | null {
  for (let i = s.length - 1; i >= 0; i--) {
    if (s[i].date <= target) return s[i].value;
  }
  return null;
}

function bps(current: number | null, past: number | null): number | null {
  if (current === null || past === null) return null;
  return parseFloat(((current - past) * 100).toFixed(1));
}

function buildRow(
  id: string,
  label: string,
  series: { date: string; value: number }[],
  isMonthly = false
): BondRow {
  if (!series.length) {
    return { id, label, current: null, dataFrequency: isMonthly ? "monthly" : "daily",
      changes: { "1D": null, "1W": null, "1M": null, "3M": null, "6M": null, "1Y": null } };
  }
  const current = series[series.length - 1].value;
  return {
    id,
    label,
    current: parseFloat(current.toFixed(3)),
    dataFrequency: isMonthly ? "monthly" : "daily",
    changes: {
      "1D": isMonthly ? null : bps(current, atIndex(series, 1)),
      "1W": isMonthly ? null : bps(current, atIndex(series, 5)),
      "1M": bps(current, valueAtDate(series, nDaysAgo(30))),
      "3M": bps(current, valueAtDate(series, nDaysAgo(91))),
      "6M": bps(current, valueAtDate(series, nDaysAgo(182))),
      "1Y": bps(current, valueAtDate(series, nDaysAgo(365))),
    },
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<YieldChangesResponse | { error: string }>
) {
  const cached = getCache<YieldChangesResponse>(CACHE_KEY);
  if (cached) return res.status(200).json(cached);

  const start = nDaysAgo(380);
  const startDE = nDaysAgo(380 * 3); // monthly needs more history for 1Y lookback

  const US_SERIES = [
    { id: "US_3M",  label: "US  3M",  fred: "DGS3MO" },
    { id: "US_6M",  label: "US  6M",  fred: "DGS6MO" },
    { id: "US_1Y",  label: "US  1Y",  fred: "DGS1"   },
    { id: "US_2Y",  label: "US  2Y",  fred: "DGS2"   },
    { id: "US_5Y",  label: "US  5Y",  fred: "DGS5"   },
    { id: "US_10Y", label: "US 10Y",  fred: "DGS10"  },
  ] as const;

  const NO_MATURITIES = ["3M", "6M", "1Y", "2Y", "5Y", "10Y"] as const;
  const NO_LABELS: Record<string, string> = {
    "3M": "NO  3M", "6M": "NO  6M", "1Y": "NO  1Y",
    "2Y": "NO  2Y", "5Y": "NO  5Y", "10Y": "NO 10Y",
  };

  try {
    const [usResults, noResults, deRaw] = await Promise.all([
      Promise.all(
        US_SERIES.map((m) =>
          fredSeries(m.fred, start)
            .then((obs) => obs.map((o) => ({ date: o.date, value: parseFloat(o.value) })))
            .catch(() => [] as { date: string; value: number }[])
        )
      ),
      Promise.all(
        NO_MATURITIES.map((m) =>
          nbFetchYield(m, start).catch(() => [] as { date: string; value: number }[])
        )
      ),
      fredSeries("IRLTLT01DEM156N", startDE)
        .then((obs) => obs.map((o) => ({ date: o.date, value: parseFloat(o.value) })))
        .catch(() => [] as { date: string; value: number }[]),
    ]);

    const rows: BondRow[] = [
      ...US_SERIES.map((m, i) => buildRow(m.id, m.label, usResults[i])),
      ...NO_MATURITIES.map((m, i) => buildRow(`NO_${m}`, NO_LABELS[m], noResults[i])),
      buildRow("DE_10Y", "DE 10Y", deRaw, true),
    ];

    const result: YieldChangesResponse = { rows, updatedAt: new Date().toISOString() };
    setCache(CACHE_KEY, result);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
