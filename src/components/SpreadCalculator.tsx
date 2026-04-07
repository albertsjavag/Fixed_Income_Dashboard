"use client";
import React, { useState } from "react";
import useSWR from "swr";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from "recharts";
import SectionCard from "./SectionCard";
import ChartTooltip from "./ChartTooltip";
import { CT, TICK_STYLE } from "@/lib/chartTheme";
import { ALL_SERIES } from "@/pages/api/series-data";
import type { SeriesDataResponse } from "@/pages/api/series-data";

import { fetcher } from "@/lib/fetcher";

const RANGE_OPTIONS = [
  { label: "3M", days: 91 },
  { label: "6M", days: 182 },
  { label: "1Y", days: 365 },
  { label: "2Y", days: 730 },
];

function dateTick(d: string) {
  const dt = new Date(d);
  return `${dt.toLocaleString("default", { month: "short" })} '${String(dt.getFullYear()).slice(2)}`;
}

export default function SpreadCalculator() {
  const [seriesA, setSeriesA] = useState("US_10Y");
  const [seriesB, setSeriesB] = useState("US_2Y");
  const [days, setDays] = useState(365);

  const url = `/api/series-data?a=${seriesA}&b=${seriesB}&days=${days}`;
  const { data, error, isLoading } = useSWR<SeriesDataResponse>(url, fetcher, { refreshInterval: 3600_000 });

  const isNegSpread = data?.currentSpread !== null && data?.currentSpread !== undefined && data.currentSpread < 0;

  return (
    <SectionCard
      label="F9"
      title="INTERACTIVE SPREAD CALCULATOR"
      description="Select any two yield series to chart them together and compute the running spread (A − B). Useful for cross-country, cross-maturity, and curve analysis."
      rightLabel="CUSTOM"
    >
      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555555" }}>SERIES A:</span>
        <select
          className="terminal-select"
          value={seriesA}
          onChange={(e) => setSeriesA(e.target.value)}
        >
          {ALL_SERIES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12, color: "var(--text-muted)" }}>−</span>

        <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555555" }}>SERIES B:</span>
        <select
          className="terminal-select"
          value={seriesB}
          onChange={(e) => setSeriesB(e.target.value)}
        >
          {ALL_SERIES.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
          {RANGE_OPTIONS.map((r) => (
            <button key={r.label} onClick={() => setDays(r.days)}
              className={`terminal-btn ${days === r.days ? "active" : ""}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Current spread metric */}
      {data && (
        <div style={{ display: "flex", gap: 2, marginBottom: 14, flexWrap: "wrap" }}>
          <MetricTile label={data.labelA} value={data.currentA} color={CT.norway} />
          <MetricTile label={data.labelB} value={data.currentB} color={CT.us} />
          <div style={{ background: "var(--surface-2)", border: `1px solid ${isNegSpread ? "rgba(255,51,51,0.3)" : "rgba(0,204,68,0.25)"}`,
            padding: "10px 16px", minWidth: 140 }}>
            <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555555", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>
              SPREAD (A−B)
            </p>
            <p style={{ fontFamily: "'Courier New', monospace", fontSize: 26, fontWeight: 900, lineHeight: 1,
              color: isNegSpread ? "var(--red)" : "var(--green)" }}>
              {data.currentSpread !== null
                ? `${data.currentSpread > 0 ? "+" : ""}${data.currentSpread.toFixed(2)}%`
                : "—"}
            </p>
            {data.currentSpread !== null && (
              <p style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "var(--text-muted)", marginTop: 4 }}>
                {Math.abs(data.currentSpread * 100).toFixed(0)} bps
              </p>
            )}
          </div>
        </div>
      )}

      {isLoading && <div className="skeleton" style={{ height: 280 }} />}
      {error && <p style={{ color: "var(--red)", fontFamily: "monospace" }}>ERR: Failed to load series data</p>}
      {data && data.points.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.points} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={CT.grid} />
            <XAxis dataKey="date" stroke={CT.axis} tick={TICK_STYLE} tickFormatter={dateTick}
              interval={Math.floor((data.points.length || 1) / 8)} />
            <YAxis stroke={CT.axis} tick={TICK_STYLE} tickFormatter={(v) => `${v.toFixed(2)}%`}
              domain={["auto", "auto"]} width={48} yAxisId="yield" />
            <YAxis yAxisId="spread" orientation="right" stroke={CT.axis} tick={TICK_STYLE}
              tickFormatter={(v) => `${v.toFixed(2)}%`} domain={["auto", "auto"]} width={48} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'Courier New', monospace" }}
              formatter={(v) => <span style={{ color: "#d4d4d4" }}>{v}</span>} />
            <ReferenceLine yAxisId="spread" y={0} stroke="rgba(255,51,51,0.5)" strokeDasharray="4 3" />
            <Line yAxisId="yield" type="monotone" dataKey="a" name={data.labelA}
              stroke={CT.norway} strokeWidth={1.5} dot={false} connectNulls />
            <Line yAxisId="yield" type="monotone" dataKey="b" name={data.labelB}
              stroke={CT.us} strokeWidth={1.5} dot={false} connectNulls />
            <Line yAxisId="spread" type="monotone" dataKey="spread" name={`Spread (${data.labelA}−${data.labelB})`}
              stroke={CT.extra2} strokeWidth={1.5} dot={false} connectNulls strokeDasharray="5 2" />
          </LineChart>
        </ResponsiveContainer>
      )}
      {data && data.points.length === 0 && (
        <p style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>NO OVERLAPPING DATA FOR SELECTED PERIOD</p>
      )}
    </SectionCard>
  );
}

function MetricTile({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "10px 16px", minWidth: 120 }}>
      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555555", fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>
        {label.toUpperCase()}
      </p>
      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 26, fontWeight: 900, lineHeight: 1, color }}>
        {value !== null ? `${value.toFixed(2)}%` : "—"}
      </p>
    </div>
  );
}
