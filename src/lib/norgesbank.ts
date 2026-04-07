// Norges Bank API — corrected dataset and key format
// GOVT_GENERIC_RATES: business daily yields
//   TBIL (Treasury Bills): 3M, 6M, 12M
//   GBON (Government Bonds): 3Y, 5Y, 7Y, 10Y
// GOVT_ZEROCOUPON: zero-coupon yields (includes 2Y, useful for steepness/spreads)

const NB_BASE = "https://data.norges-bank.no/api/data";

export interface NBPoint {
  date: string;
  value: number;
}

// Generic SDMX-JSON parser for Norges Bank responses
async function fetchSDMX(url: string): Promise<NBPoint[]> {
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Norges Bank request failed ${res.status}: ${url}\n${body.slice(0, 200)}`);
  }
  const json = await res.json();
  const struct = json.data.structure;
  const ds = json.data.dataSets[0];
  const series = ds.series as Record<string, { observations: Record<string, number[]> }>;

  // Find the time dimension in the observation dimensions
  const obsDims: { id: string; values: { id: string }[] }[] = struct.dimensions.observation;
  const timeDim = obsDims.find((d) => d.id === "TIME_PERIOD");
  if (!timeDim) throw new Error("TIME_PERIOD dimension not found");

  // There should be exactly one series key when fetching a single tenor
  const seriesKey = Object.keys(series)[0];
  if (!seriesKey) return [];
  const observations = series[seriesKey].observations;

  return Object.entries(observations)
    .map(([idx, vals]) => {
      // Norges Bank returns values as strings inside the array e.g. ['4.172']
      const raw = (vals as (string | number | null)[])[0];
      const numVal = raw !== null && raw !== undefined ? parseFloat(String(raw)) : NaN;
      return {
        date: timeDim.values[parseInt(idx)].id,
        value: numVal,
      };
    })
    .filter((p) => isFinite(p.value))   // filters NaN and Infinity (covers null→NaN)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Internal maturity → dataset/instrument/tenorCode mapping
type MaturityCode = "3M" | "6M" | "1Y" | "2Y" | "5Y" | "10Y";

interface MaturitySpec {
  dataset: "GOVT_GENERIC_RATES" | "GOVT_ZEROCOUPON";
  tenorCode: string;       // as used in the API key
  instrument?: string;     // only for GOVT_GENERIC_RATES
}

const MATURITY_SPECS: Record<MaturityCode, MaturitySpec> = {
  "3M":  { dataset: "GOVT_GENERIC_RATES", tenorCode: "3M",  instrument: "TBIL" },
  "6M":  { dataset: "GOVT_GENERIC_RATES", tenorCode: "6M",  instrument: "TBIL" },
  "1Y":  { dataset: "GOVT_GENERIC_RATES", tenorCode: "12M", instrument: "TBIL" },
  "2Y":  { dataset: "GOVT_ZEROCOUPON",    tenorCode: "2Y" },
  "5Y":  { dataset: "GOVT_GENERIC_RATES", tenorCode: "5Y",  instrument: "GBON" },
  "10Y": { dataset: "GOVT_GENERIC_RATES", tenorCode: "10Y", instrument: "GBON" },
};

function buildUrl(spec: MaturitySpec, startDate?: string): string {
  const base = NB_BASE;
  let key: string;
  if (spec.dataset === "GOVT_GENERIC_RATES") {
    key = `B.${spec.tenorCode}.${spec.instrument}`;
  } else {
    // GOVT_ZEROCOUPON key format: B.{tenor}
    key = `B.${spec.tenorCode}`;
  }
  const params = new URLSearchParams({ "format": "sdmx-json", "locale": "en" });
  if (startDate) params.set("startPeriod", startDate);
  return `${base}/${spec.dataset}/${key}?${params}`;
}

export async function nbFetchYield(maturity: MaturityCode, startDate?: string): Promise<NBPoint[]> {
  const spec = MATURITY_SPECS[maturity];
  if (!spec) throw new Error(`Unknown maturity: ${maturity}`);
  return fetchSDMX(buildUrl(spec, startDate));
}

// Fetch multiple maturities and return flat array of {date, maturity, value}
export async function nbFetchAll(
  maturities: MaturityCode[],
  startDate?: string
): Promise<{ date: string; maturity: string; value: number }[]> {
  const results = await Promise.all(
    maturities.map((m) =>
      nbFetchYield(m, startDate)
        .then((pts) => pts.map((p) => ({ ...p, maturity: m })))
        .catch(() => [] as { date: string; maturity: string; value: number }[])
    )
  );
  return results.flat();
}

export const NB_CURVE_MATURITIES: MaturityCode[] = ["3M", "6M", "1Y", "2Y", "5Y", "10Y"];
