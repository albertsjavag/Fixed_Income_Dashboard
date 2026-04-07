// Forward Rate API — replaces the live yield curve section
// Computes implied forward rates from the current spot yield curve.
// Formula: f(t1→t2) = (r2*t2 - r1*t1) / (t2-t1)   [continuous compounding approx]
// This is genuinely forward-looking: it shows what the market is pricing for future rates.
//
// Available for: US (6 maturities, daily FRED) and Norway (6 maturities, daily Norges Bank)
// Not available for Germany: requires multi-maturity daily data.

import type { NextApiRequest, NextApiResponse } from "next";
import { fredLatest } from "@/lib/fred";
import { nbFetchYield } from "@/lib/norgesbank";
import { getCache, setCache } from "@/lib/cache";

const CACHE_KEY = "forward-rates";

interface SpotPoint {
  maturity: string;   // label, e.g. "3M"
  years: number;      // decimal years
  rate: number | null;
}

interface ForwardPoint {
  label: string;      // e.g. "5Y5Y"
  description: string;
  fromYears: number;
  toYears: number;
  rate: number | null;
}

export interface ForwardRatesResponse {
  us: {
    spot: SpotPoint[];
    forwards: ForwardPoint[];
  };
  norway: {
    spot: SpotPoint[];
    forwards: ForwardPoint[];
  };
  updatedAt: string;
  note: string;
}

// Forward rate between two maturities (simple approximation, works for par yields)
function fwd(r1: number | null, t1: number, r2: number | null, t2: number): number | null {
  if (r1 === null || r2 === null) return null;
  const result = (r2 * t2 - r1 * t1) / (t2 - t1);
  return parseFloat(result.toFixed(3));
}

// Define the forward rate pairs we want to compute and label
function computeForwards(spot: SpotPoint[]): ForwardPoint[] {
  const r = (label: string) => spot.find((p) => p.maturity === label) ?? null;
  const get = (label: string): { rate: number | null; years: number } => {
    const p = r(label);
    return { rate: p?.rate ?? null, years: p?.years ?? 0 };
  };

  const pairs: { label: string; description: string; from: string; to: string }[] = [
    { label: "3M→6M",   description: "3M rate expected in 3 months",          from: "3M",  to: "6M" },
    { label: "6M→1Y",   description: "6M rate expected in 6 months",          from: "6M",  to: "1Y" },
    { label: "1Y→2Y",   description: "1Y rate in 1Y (key policy horizon)",    from: "1Y",  to: "2Y" },
    { label: "2Y→5Y",   description: "3Y rate starting in 2Y (medium term)",  from: "2Y",  to: "5Y" },
    { label: "5Y→10Y",  description: "5Y5Y — long-run rate anchor",           from: "5Y",  to: "10Y" },
  ];

  return pairs.map(({ label, description, from, to }) => {
    const a = get(from);
    const b = get(to);
    return {
      label,
      description,
      fromYears: a.years,
      toYears: b.years,
      rate: fwd(a.rate, a.years, b.rate, b.years),
    };
  });
}

const US_MATURITIES: SpotPoint[] = [
  { maturity: "3M",  years: 0.25, rate: null },
  { maturity: "6M",  years: 0.5,  rate: null },
  { maturity: "1Y",  years: 1,    rate: null },
  { maturity: "2Y",  years: 2,    rate: null },
  { maturity: "5Y",  years: 5,    rate: null },
  { maturity: "10Y", years: 10,   rate: null },
];

const US_FRED: Record<string, string> = {
  "3M": "DGS3MO", "6M": "DGS6MO", "1Y": "DGS1",
  "2Y": "DGS2",   "5Y": "DGS5",   "10Y": "DGS10",
};

const NO_MATURITIES: SpotPoint[] = [
  { maturity: "3M",  years: 0.25, rate: null },
  { maturity: "6M",  years: 0.5,  rate: null },
  { maturity: "1Y",  years: 1,    rate: null },
  { maturity: "2Y",  years: 2,    rate: null },
  { maturity: "5Y",  years: 5,    rate: null },
  { maturity: "10Y", years: 10,   rate: null },
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ForwardRatesResponse | { error: string }>
) {
  const cached = getCache<ForwardRatesResponse>(CACHE_KEY);
  if (cached) return res.status(200).json(cached);

  try {
    // Fetch US spot rates (FRED)
    const usSpotPromises = US_MATURITIES.map((p) =>
      fredLatest(US_FRED[p.maturity]).catch(() => null)
    );

    // Fetch Norway spot rates (Norges Bank — correct API)
    const noSpotPromises = NO_MATURITIES.map((p) =>
      nbFetchYield(p.maturity as Parameters<typeof nbFetchYield>[0])
        .then((pts) => (pts.length ? pts[pts.length - 1].value : null))
        .catch(() => null)
    );

    const [usRaw, noRaw] = await Promise.all([
      Promise.all(usSpotPromises),
      Promise.all(noSpotPromises),
    ]);

    const usSpot: SpotPoint[] = US_MATURITIES.map((p, i) => ({
      ...p,
      rate: usRaw[i]?.value ?? null,
    }));

    const noSpot: SpotPoint[] = NO_MATURITIES.map((p, i) => ({
      ...p,
      rate: noRaw[i] ?? null,
    }));

    const result: ForwardRatesResponse = {
      us: { spot: usSpot, forwards: computeForwards(usSpot) },
      norway: { spot: noSpot, forwards: computeForwards(noSpot) },
      updatedAt: new Date().toISOString(),
      note: "Germany excluded: implied forward rates require daily multi-maturity data. Only monthly 10Y available via FRED.",
    };

    setCache(CACHE_KEY, result);
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
