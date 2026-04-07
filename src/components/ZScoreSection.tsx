"use client";
import React from "react";
import useSWR from "swr";
import { LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer } from "recharts";
import SectionCard from "./SectionCard";
import { CT } from "@/lib/chartTheme";
import type { ZScoreResponse, ZScoreEntry } from "@/pages/api/zscore";

import { fetcher } from "@/lib/fetcher";

const COUNTRY_COLOR: Record<string, string> = {
  Norway: CT.norway,
  Germany: CT.germany,
  "United States": CT.us,
};

const LEVEL_COLOR: Record<ZScoreEntry["level"], string> = {
  "extreme-high": "var(--red)",
  elevated:       "var(--yellow)",
  normal:         "var(--green)",
  depressed:      "var(--yellow)",
  "extreme-low":  "var(--red)",
  unavailable:    "var(--text-muted)",
};

export default function ZScoreSection() {
  const { data, error, isLoading } = useSWR<ZScoreResponse>("/api/zscore", fetcher, { refreshInterval: 3600_000 });

  return (
    <SectionCard
      label="F5"
      title="Z-SCORE — RELATIVE YIELD LEVEL"
      description="Standard deviations from 1Y mean. Beyond ±2σ = historically extreme. Use for mean-reversion signals and position sizing. Norway/US: daily data (robust). Germany: monthly (indicative only)."
      rightLabel="1Y LOOKBACK"
    >
      {isLoading && <div className="skeleton" style={{ height: 200 }} />}
      {error && <p style={{ color: "var(--red)", fontFamily: "monospace" }}>ERR: Failed to load z-score data</p>}
      {data?.entries && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 2 }}>
          {data.entries.map((e) => <ZCard key={e.country} entry={e} />)}
        </div>
      )}
    </SectionCard>
  );
}

function ZCard({ entry }: { entry: ZScoreEntry }) {
  const color = COUNTRY_COLOR[entry.country] ?? "#888888";
  const lcolor = LEVEL_COLOR[entry.level];

  return (
    <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700, color: "#555555", letterSpacing: "0.1em" }}>
          {entry.country.toUpperCase()} / 10Y
        </p>
        <span style={{
          fontFamily: "'Courier New', monospace", fontSize: 9, fontWeight: 700,
          padding: "1px 5px", letterSpacing: "0.05em",
          background: entry.dataQuality === "monthly" ? "rgba(255,255,0,0.06)" : "rgba(0,204,68,0.06)",
          border: `1px solid ${entry.dataQuality === "monthly" ? "rgba(255,255,0,0.2)" : "rgba(0,204,68,0.2)"}`,
          color: entry.dataQuality === "monthly" ? "var(--yellow)" : "var(--green)",
        }}>
          {entry.dataQuality.toUpperCase()} · {entry.dataPoints}pts
        </span>
      </div>

      <div style={{ display: "flex", gap: 20, marginBottom: 8 }}>
        <div>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "var(--text-muted)" }}>YIELD</p>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: 24, fontWeight: 900, color: "var(--amber)", lineHeight: 1 }}>
            {entry.currentYield !== null ? `${entry.currentYield}%` : "—"}
          </p>
        </div>
        <div>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "var(--text-muted)" }}>Z-SCORE</p>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: 24, fontWeight: 900, color: lcolor, lineHeight: 1 }}>
            {entry.zScore !== null ? `${entry.zScore > 0 ? "+" : ""}${entry.zScore}σ` : "—"}
          </p>
        </div>
      </div>

      <span style={{
        fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700,
        padding: "2px 6px", background: "rgba(0,0,0,0.4)", border: `1px solid ${lcolor}33`,
        color: lcolor, letterSpacing: "0.05em", display: "inline-block", marginBottom: 12,
      }}>
        {entry.interpretation.toUpperCase()}
      </span>

      {entry.sparkline.length > 0 && (
        <ResponsiveContainer width="100%" height={60}>
          <LineChart data={entry.sparkline} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
            <YAxis domain={[-3, 3]} hide />
            <XAxis dataKey="date" hide />
            <ReferenceLine y={2}  stroke="rgba(255,51,51,0.35)" strokeDasharray="2 2" />
            <ReferenceLine y={-2} stroke="rgba(255,51,51,0.35)" strokeDasharray="2 2" />
            <ReferenceLine y={0}  stroke="rgba(136,136,136,0.3)" strokeDasharray="2 2" />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div style={{ background: "#0d0d0d", border: "1px solid #252525", padding: "5px 8px", fontSize: 10, fontFamily: "monospace" }}>
                    <div style={{ color: "#555555" }}>{label}</div>
                    <div style={{ color, fontWeight: 700 }}>
                      {(payload[0].value as number) > 0 ? "+" : ""}
                      {(payload[0].value as number).toFixed(2)}σ
                    </div>
                  </div>
                ) : null
              }
            />
            <Line type="monotone" dataKey="z" stroke={color} strokeWidth={1.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "var(--text-muted)", marginTop: 2, letterSpacing: "0.05em" }}>
        3M Z-SCORE TREND
        {entry.dataQuality === "monthly" && " · LOW RESOLUTION — INDICATIVE ONLY"}
      </p>
    </div>
  );
}
