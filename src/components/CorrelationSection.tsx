"use client";
import React, { useState } from "react";
import useSWR from "swr";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea, ResponsiveContainer } from "recharts";
import SectionCard from "./SectionCard";
import ChartTooltip from "./ChartTooltip";
import { CT, TICK_STYLE } from "@/lib/chartTheme";
import type { CorrelationResponse, CorrelationPoint } from "@/pages/api/correlation";

import { fetcher } from "@/lib/fetcher";

function dateTick(d: string) {
  const dt = new Date(d);
  return `${dt.toLocaleString("default", { month: "short" })} '${String(dt.getFullYear()).slice(2)}`;
}

function findLowRanges(data: CorrelationPoint[]) {
  const ranges: { start: string; end: string }[] = [];
  let inRange = false, rangeStart = "";
  for (const p of data) {
    const low = p.noUsCorr !== null && p.noUsCorr < 0.3;
    if (low && !inRange) { inRange = true; rangeStart = p.date; }
    else if (!low && inRange) { ranges.push({ start: rangeStart, end: p.date }); inRange = false; }
  }
  if (inRange && data.length) ranges.push({ start: rangeStart, end: data[data.length - 1].date });
  return ranges;
}

export default function CorrelationSection() {
  const [win, setWin] = useState<"30d" | "90d">("30d");
  const { data, error, isLoading } = useSWR<CorrelationResponse>("/api/correlation", fetcher, { refreshInterval: 3600_000 });
  const chartData = data ? (win === "30d" ? data.data30d : data.data90d) : [];
  const lowRanges = findLowRanges(chartData);

  // Current correlation value
  const latestCorr = [...chartData].reverse().find((p) => p.noUsCorr !== null)?.noUsCorr ?? null;

  return (
    <SectionCard
      label="F6"
      title="ROLLING YIELD CORRELATION — NO vs US"
      description="30d/90d Pearson correlation between Norwegian and US 10Y yields. Near +1 = yields move in lockstep (global macro dominates). Drop below 0.3 (highlighted) = domestic factors breaking the relationship."
      rightLabel="2Y  |  DAILY DATA"
    >
      <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        {(["30d", "90d"] as const).map((w) => (
          <button key={w} onClick={() => setWin(w)} className={`terminal-btn ${win === w ? "active" : ""}`}>
            {w} WINDOW
          </button>
        ))}
        {latestCorr !== null && (
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 700, marginLeft: 12,
            color: latestCorr < 0.3 ? "var(--red)" : latestCorr > 0.7 ? "var(--green)" : "var(--amber)" }}>
            CURRENT: {latestCorr.toFixed(3)}
            {latestCorr < 0.3 && " ← REGIME BREAK"}
          </span>
        )}
      </div>

      {isLoading && <div className="skeleton" style={{ height: 280 }} />}
      {error && <p style={{ color: "var(--red)", fontFamily: "monospace" }}>ERR: Failed to load correlation data</p>}
      {data && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={CT.grid} />
            <XAxis dataKey="date" stroke={CT.axis} tick={TICK_STYLE} tickFormatter={dateTick}
              interval={Math.floor((chartData.length || 1) / 8)} />
            <YAxis stroke={CT.axis} tick={TICK_STYLE} domain={[-1, 1]}
              ticks={[-1, -0.5, 0, 0.5, 1]} tickFormatter={(v) => v.toFixed(1)} width={36} />
            <Tooltip content={<ChartTooltip unit="" />} />
            <ReferenceLine y={0} stroke={CT.axis} strokeDasharray="4 3" />
            <ReferenceLine y={0.3} stroke="rgba(255,51,51,0.4)" strokeDasharray="3 2"
              label={{ value: "0.3 REGIME THRESHOLD", fill: "rgba(255,51,51,0.5)",
                fontSize: 9, position: "insideRight",
                style: { fontFamily: "'Courier New', monospace" } }} />
            {lowRanges.map((r, i) => (
              <ReferenceArea key={i} x1={r.start} x2={r.end} fill="rgba(255,51,51,0.05)" stroke="none" />
            ))}
            <Line type="monotone" dataKey="noUsCorr" name="NO 10Y vs US 10Y"
              stroke={CT.norway} strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
      {data && chartData.length === 0 && (
        <p style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>INSUFFICIENT DATA</p>
      )}
      {data?.note && <p className="note">⚠ {data.note}</p>}
    </SectionCard>
  );
}
