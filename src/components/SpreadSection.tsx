"use client";
import React from "react";
import useSWR from "swr";
import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import SectionCard from "./SectionCard";
import ChartTooltip from "./ChartTooltip";
import { CT, TICK_STYLE } from "@/lib/chartTheme";
import type { SpreadsResponse } from "@/pages/api/spreads";

import { fetcher } from "@/lib/fetcher";

function dateTick(date: string) {
  const d = new Date(date);
  return `${d.toLocaleString("default", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
}

export default function SpreadSection() {
  const { data, error, isLoading } = useSWR<SpreadsResponse>("/api/spreads", fetcher, { refreshInterval: 3600_000 });

  return (
    <SectionCard
      label="F3"
      title="SPREAD MONITOR"
      description="Yield differentials between sovereign bonds. NO−US spread reflects relative monetary policy stance. US 2Y−10Y inversion has preceded every US recession since 1955 (avg 14-month lead)."
      rightLabel="2Y HISTORY  |  DAILY"
    >
      {isLoading && <div className="skeleton" style={{ height: 320 }} />}
      {error && <p style={{ color: "var(--red)", fontFamily: "monospace" }}>ERR: Failed to load spread data</p>}
      {data && (
        <>
          <SpreadChart
            data={data.data}
            title="NO 10Y − US 10Y  [CROSS-COUNTRY SPREAD]"
            dataKey="noUsSpread"
            color={CT.norway}
          />
          <SpreadChart
            data={data.data}
            title="US 2Y − US 10Y  [INVERSION INDICATOR]"
            dataKey="usInversion"
            color={CT.us}
            style={{ marginTop: 20 }}
          />
          <SpreadChart
            data={data.data}
            title="NO 2Y − NO 10Y  [CURVE SHAPE]"
            dataKey="noInversion"
            color={CT.germany}
            style={{ marginTop: 20 }}
          />
        </>
      )}
    </SectionCard>
  );
}

interface SpreadChartProps {
  data: SpreadsResponse["data"];
  title: string;
  dataKey: keyof SpreadsResponse["data"][0];
  color: string;
  style?: React.CSSProperties;
}

function SpreadChart({ data, title, dataKey, color, style }: SpreadChartProps) {
  const latest = [...data].reverse().find((p) => p[dataKey] !== null);
  const val = latest ? (latest[dataKey] as number) : null;
  const isNeg = val !== null && val < 0;

  return (
    <div style={style}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <p style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 700, color: "#888888", letterSpacing: "0.06em" }}>
          {title}
        </p>
        {val !== null && (
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: 700,
            color: isNeg ? "var(--red)" : "var(--green)" }}>
            {val > 0 ? "+" : ""}{val.toFixed(2)}%
          </span>
        )}
        {isNeg && <span className="badge badge-red">INVERTED</span>}
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <ComposedChart data={data} margin={{ top: 2, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={CT.grid} />
          <XAxis dataKey="date" stroke={CT.axis} tick={TICK_STYLE} tickFormatter={dateTick}
            interval={Math.floor((data.length || 1) / 8)} />
          <YAxis stroke={CT.axis} tick={TICK_STYLE} tickFormatter={(v) => `${v.toFixed(1)}%`}
            domain={["auto", "auto"]} width={42} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={0} stroke="rgba(255,51,51,0.6)" strokeDasharray="4 3" strokeWidth={1.5} />
          <Line type="monotone" dataKey={dataKey as string} name={title}
            stroke={color} strokeWidth={1.5} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
