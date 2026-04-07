"use client";
// F1: Implied Forward Rates (replaces static yield curve snapshot)
// Derived from the current spot yield curve using: f(t1→t2) = (r2*t2 - r1*t1) / (t2-t1)
// Genuinely forward-looking: shows what the market is pricing for future rates.

import React from "react";
import useSWR from "swr";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine,
} from "recharts";
import SectionCard from "./SectionCard";
import ChartTooltip from "./ChartTooltip";
import { CT, TICK_STYLE } from "@/lib/chartTheme";
import type { ForwardRatesResponse } from "@/pages/api/forward-rates";

import { fetcher } from "@/lib/fetcher";

// X-axis labels for the combined chart (spot points + forward point labels)
// Forward rate "5Y→10Y" is plotted at the midpoint or start, so we label by start year
const SPOT_X: Record<string, number> = { "3M": 0.25, "6M": 0.5, "1Y": 1, "2Y": 2, "5Y": 5, "10Y": 10 };
const FWD_START_X: Record<string, number> = {
  "3M→6M": 0.25, "6M→1Y": 0.5, "1Y→2Y": 1, "2Y→5Y": 2, "5Y→10Y": 5,
};

// Build chart data: one row per x-axis point, columns for spot and forward
function buildChartData(data: ForwardRatesResponse) {
  // Spot curve points
  const spotPoints = data.us.spot.map((p) => ({
    x: SPOT_X[p.maturity] ?? null,
    label: p.maturity,
    usSpot: p.rate,
    noSpot: data.norway.spot.find((n) => n.maturity === p.maturity)?.rate ?? null,
    usFwd: null as number | null,
    noFwd: null as number | null,
    isFwd: false,
  }));

  // Forward rate points — plotted at the start of the forward period
  const fwdPoints = data.us.forwards.map((f) => ({
    x: FWD_START_X[f.label] ?? null,
    label: f.label,
    usSpot: null as number | null,
    noSpot: null as number | null,
    usFwd: f.rate,
    noFwd: data.norway.forwards.find((n) => n.label === f.label)?.rate ?? null,
    isFwd: true,
  }));

  // Merge and sort by x
  return [...spotPoints, ...fwdPoints]
    .filter((p) => p.x !== null)
    .sort((a, b) => a.x! - b.x!);
}

const FORWARD_DESCS: Record<string, string> = {
  "3M→6M":  "Where will 3M rates be in 3 months?",
  "6M→1Y":  "Where will 6M rates be in 6 months?",
  "1Y→2Y":  "Where will 1Y rates be in 1 year? (policy horizon)",
  "2Y→5Y":  "3Y rate starting 2 years out (medium term)",
  "5Y→10Y": "5Y5Y — long-run rate anchor watched by central banks",
};

export default function ForwardRateSection() {
  const { data, error, isLoading } = useSWR<ForwardRatesResponse>(
    "/api/forward-rates", fetcher, { refreshInterval: 3600_000 }
  );

  return (
    <SectionCard
      label="F1"
      title="IMPLIED FORWARD RATES"
      description="Derived from today's yield curve. f(t1→t2) = what the market prices for rates at a future date. Forward-looking — unlike spot yields, these embed market expectations about central bank policy."
      rightLabel="DAILY FRED + NB"
    >
      {isLoading && <div className="skeleton" style={{ height: 320 }} />}
      {error && <p style={{ color: "var(--red)", fontFamily: "monospace" }}>ERR: Failed to load forward rate data</p>}
      {data && (
        <>
          {/* Key forward rate cards */}
          <div style={{ display: "flex", gap: 2, marginBottom: 14, flexWrap: "wrap" }}>
            {data.us.forwards.map((fwd) => {
              const noFwd = data.norway.forwards.find((f) => f.label === fwd.label);
              return (
                <div key={fwd.label}
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "10px 14px", minWidth: 130, flex: "1 1 130px" }}
                  title={FORWARD_DESCS[fwd.label]}
                >
                  <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700,
                    color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 6 }}>
                    {fwd.label}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#444444" }}>US</p>
                      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 18, fontWeight: 900,
                        color: CT.us, lineHeight: 1 }}>
                        {fwd.rate !== null ? `${fwd.rate.toFixed(2)}%` : "—"}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#444444" }}>NO</p>
                      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 18, fontWeight: 900,
                        color: CT.norway, lineHeight: 1 }}>
                        {noFwd?.rate !== null && noFwd?.rate !== undefined ? `${noFwd.rate.toFixed(2)}%` : "—"}
                      </p>
                    </div>
                  </div>
                  <p style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#333333",
                    marginTop: 6, lineHeight: 1.4 }}>
                    {FORWARD_DESCS[fwd.label]}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Spot vs forward chart */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
            <SpotVsFwdChart country="US" spot={data.us.spot} forwards={data.us.forwards} color={CT.us} />
            <SpotVsFwdChart country="Norway" spot={data.norway.spot} forwards={data.norway.forwards} color={CT.norway} />
          </div>

          <p className="note">⚠ {data.note}</p>
        </>
      )}
    </SectionCard>
  );
}

interface SpotVsFwdProps {
  country: string;
  spot: { maturity: string; years: number; rate: number | null }[];
  forwards: { label: string; fromYears: number; rate: number | null }[];
  color: string;
}

function SpotVsFwdChart({ country, spot, forwards, color }: SpotVsFwdProps) {
  // Build unified chart data with both spot and forward on same x-axis (years)
  const spotData = spot
    .filter((p) => p.rate !== null)
    .map((p) => ({ years: p.years, label: p.maturity, spot: p.rate, fwd: null as number | null }));

  const fwdData = forwards
    .filter((f) => f.rate !== null)
    .map((f) => ({ years: f.fromYears, label: f.label, spot: null as number | null, fwd: f.rate }));

  const merged = [...spotData, ...fwdData]
    .sort((a, b) => a.years - b.years);

  // Custom x-axis formatter
  const xFmt = (v: number) => {
    if (v === 0.25) return "3M";
    if (v === 0.5)  return "6M";
    if (v === 1)    return "1Y";
    if (v === 2)    return "2Y";
    if (v === 5)    return "5Y";
    if (v === 10)   return "10Y";
    return `${v}Y`;
  };

  return (
    <div>
      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700,
        color: "#555555", letterSpacing: "0.08em", marginBottom: 6 }}>
        {country.toUpperCase()} — SPOT vs FORWARD CURVE
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={merged} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={CT.grid} />
          <XAxis dataKey="years" type="number" scale="log" domain={[0.2, 12]}
            stroke={CT.axis} tick={TICK_STYLE} tickFormatter={xFmt}
            ticks={[0.25, 0.5, 1, 2, 5, 10]} />
          <YAxis stroke={CT.axis} tick={TICK_STYLE} tickFormatter={(v) => `${v}%`}
            domain={["auto", "auto"]} width={42} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 10, fontFamily: "'Courier New', monospace" }}
            formatter={(v) => <span style={{ color: "#d4d4d4" }}>{v}</span>} />
          <Line type="monotone" dataKey="spot" name="Spot" stroke={color}
            strokeWidth={2} dot={{ r: 3, fill: color }} connectNulls />
          <Line type="monotone" dataKey="fwd" name="Implied Forward" stroke={color}
            strokeWidth={2} strokeDasharray="6 3" dot={{ r: 4, fill: color, strokeWidth: 2, stroke: "#000" }}
            connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
