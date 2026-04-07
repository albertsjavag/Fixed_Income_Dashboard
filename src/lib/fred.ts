// FRED API helpers — never called from the browser, only from API routes
const FRED_BASE = "https://api.stlouisfed.org/fred";

export async function fredSeries(
  seriesId: string,
  observationStart?: string, // YYYY-MM-DD
  observationEnd?: string
): Promise<{ date: string; value: string }[]> {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY is not set");

  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: key,
    file_type: "json",
    sort_order: "asc",
  });
  if (observationStart) params.set("observation_start", observationStart);
  if (observationEnd) params.set("observation_end", observationEnd);

  const url = `${FRED_BASE}/series/observations?${params}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`FRED request failed: ${res.status} ${seriesId}`);

  const json = await res.json();
  // FRED returns "." for missing values
  return (json.observations as { date: string; value: string }[]).filter(
    (o) => o.value !== "."
  );
}

// Return the n most recent observations
export async function fredLatest(
  seriesId: string,
  limit = 1
): Promise<{ date: string; value: number } | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) throw new Error("FRED_API_KEY is not set");

  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: key,
    file_type: "json",
    sort_order: "desc",
    limit: String(limit),
  });

  const url = `${FRED_BASE}/series/observations?${params}`;
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`FRED request failed: ${res.status} ${seriesId}`);

  const json = await res.json();
  const obs = (json.observations as { date: string; value: string }[]).filter(
    (o) => o.value !== "."
  );
  if (!obs.length) return null;
  return { date: obs[0].date, value: parseFloat(obs[0].value) };
}

// nDaysAgo returns YYYY-MM-DD for n days before today
export function nDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
