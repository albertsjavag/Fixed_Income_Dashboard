"use client";
import React from "react";
import useSWR from "swr";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import SectionCard from "./SectionCard";
import ChartTooltip from "./ChartTooltip";
import { CT, TICK_STYLE } from "@/lib/chartTheme";
import type { BreakevenResponse } from "@/pages/api/breakeven";

import { fetcher } from "@/lib/fetcher";

function dateTick(d: string) {
  const dt = new Date(d);
  return `${dt.toLocaleString("default", { month: "short" })} '${String(dt.getFullYear()).slice(2)}`;
}

export default function BreakevenSection() {
  const { data, error, isLoading } = useSWR<BreakevenResponse>("/api/breakeven", fetcher, { refreshInterval: 3600_000 });

  return (
    <SectionCard
      label="F7"
      title="BREAKEVEN INFLATION"
      description="Nominal 10Y yield minus real (TIPS) yield = market's 10Y inflation forecast. Sustained readings above 2% signal markets expect central banks to miss their target."
      rightLabel="US ONLY"
    >
      {isLoading && <div className="skeleton" style={{ height: 280 }} />}
      {error && <p style={{ color: "var(--red)", fontFamily: "monospace" }}>ERR: Failed to load breakeven data</p>}
      {data && (
        <>
          <div style={{ display: "flex", gap: 2, marginBottom: 16, flexWrap: "wrap" }}>
            {/* US metric card */}
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "12px 16px", minWidth: 160 }}>
              <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555555", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 }}>
                US 10Y BREAKEVEN
              </p>
              <p style={{ fontFamily: "'Courier New', monospace", fontSize: 30, fontWeight: 900, color: CT.us, lineHeight: 1 }}>
                {data.currentUS !== null ? `${data.currentUS.toFixed(2)}%` : "—"}
              </p>
              {data.currentUS !== null && (
                <span style={{
                  fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700,
                  display: "inline-block", marginTop: 8, padding: "1px 6px",
                  background: data.usAboveTarget ? "rgba(255,51,51,0.12)" : "rgba(0,204,68,0.12)",
                  border: `1px solid ${data.usAboveTarget ? "rgba(255,51,51,0.3)" : "rgba(0,204,68,0.3)"}`,
                  color: data.usAboveTarget ? "var(--red)" : "var(--green)",
                }}>
                  {data.usAboveTarget ? "▲ ABOVE 2% TARGET" : "▼ BELOW 2% TARGET"}
                </span>
              )}
              {data.currentUSDate && (
                <p style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "var(--text-muted)", marginTop: 6 }}>
                  AS OF {data.currentUSDate}
                </p>
              )}
            </div>

            {/* Tooltip explanation */}
            <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", padding: "12px 16px", maxWidth: 340, display: "flex", alignItems: "center" }}>
              <p style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "var(--text-dim)", lineHeight: 1.7 }}>
                <span style={{ color: "var(--amber)", fontWeight: 700 }}>BREAKEVEN INFLATION</span> shows what the market expects average inflation to be over the next 10 years. Derived from US TIPS vs nominal treasuries (FRED: T10YIE).
              </p>
            </div>
          </div>

          {data.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={data.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={CT.grid} />
                <XAxis dataKey="date" stroke={CT.axis} tick={TICK_STYLE} tickFormatter={dateTick}
                  interval={Math.floor((data.data.length || 1) / 8)} />
                <YAxis stroke={CT.axis} tick={TICK_STYLE} tickFormatter={(v) => `${v}%`} domain={["auto", "auto"]} width={42} />
                <Tooltip content={<ChartTooltip />} />
                <ReferenceLine y={2} stroke="rgba(255,153,0,0.5)" strokeDasharray="4 3"
                  label={{ value: "2.00% TARGET", fill: "rgba(255,153,0,0.7)", fontSize: 9, position: "insideTopRight",
                    style: { fontFamily: "'Courier New', monospace" } }} />
                <Line type="monotone" dataKey="us" name="US 10Y Breakeven" stroke={CT.us} strokeWidth={1.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ fontFamily: "monospace", color: "var(--text-muted)" }}>NO DATA AVAILABLE</p>
          )}

          <p className="note">⚠ {data.norwayNote}</p>
          <p className="note" style={{ marginTop: 6 }}>⚠ {data.germanyNote}</p>
        </>
      )}
    </SectionCard>
  );
}
