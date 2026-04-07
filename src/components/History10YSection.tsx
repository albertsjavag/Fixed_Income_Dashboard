"use client";
import React from "react";
import useSWR from "swr";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import SectionCard from "./SectionCard";
import ChartTooltip from "./ChartTooltip";
import { CT, TICK_STYLE } from "@/lib/chartTheme";
import type { History10YResponse } from "@/pages/api/history-10y";

import { fetcher } from "@/lib/fetcher";

function dateTick(date: string) {
  const d = new Date(date);
  return `${d.toLocaleString("default", { month: "short" })} '${String(d.getFullYear()).slice(2)}`;
}

export default function History10YSection() {
  const { data, error, isLoading } = useSWR<History10YResponse>("/api/history-10y", fetcher, { refreshInterval: 3600_000 });

  return (
    <SectionCard
      label="F2"
      title="10Y YIELD HISTORY"
      description="2-year time series of benchmark 10Y yields. Convergence = shared macro driver (Fed, ECB). Divergence = local factors dominating."
      rightLabel="2Y LOOKBACK"
    >
      {isLoading && <div className="skeleton" style={{ height: 300 }} />}
      {error && <p style={{ color: "var(--red)", fontFamily: "monospace" }}>ERR: Failed to load historical data</p>}
      {data && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={CT.grid} />
            <XAxis dataKey="date" stroke={CT.axis} tick={TICK_STYLE} tickFormatter={dateTick}
              interval={Math.floor((data.data.length || 1) / 8)} />
            <YAxis stroke={CT.axis} tick={TICK_STYLE} tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} width={42} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'Courier New', monospace" }}
              formatter={(v) => <span style={{ color: "#d4d4d4" }}>{v}</span>} />
            <Line type="monotone" dataKey="norway" name="NO 10Y" stroke={CT.norway} strokeWidth={1.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="germany" name="DE 10Y" stroke={CT.germany} strokeWidth={1.5} dot={false} connectNulls />
            <Line type="monotone" dataKey="us" name="US 10Y" stroke={CT.us} strokeWidth={1.5} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
    </SectionCard>
  );
}
