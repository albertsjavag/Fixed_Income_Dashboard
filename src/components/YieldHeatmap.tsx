"use client";
import React, { useState } from "react";
import useSWR from "swr";
import SectionCard from "./SectionCard";
import type { YieldChangesResponse, BondRow } from "@/pages/api/yield-changes";

import { fetcher } from "@/lib/fetcher";

const HORIZONS = ["1D", "1W", "1M", "3M", "6M", "1Y"] as const;
type Horizon = typeof HORIZONS[number];

// Color scale: red = yields rose (bad for bondholders), green = yields fell
// Scale is clamped at ±100bps
function heatColor(bps: number | null): { bg: string; fg: string } {
  if (bps === null) return { bg: "#111111", fg: "#333333" };
  if (Math.abs(bps) < 0.5) return { bg: "#141414", fg: "#555555" }; // near zero

  const intensity = Math.min(Math.abs(bps) / 80, 1); // saturate at 80bps
  if (bps > 0) {
    // Red — yield rose
    const r = 200 + Math.round(55 * intensity);
    const gb = Math.round(40 * (1 - intensity));
    return { bg: `rgba(${r},${gb},${gb},${0.15 + 0.55 * intensity})`, fg: `rgb(${r},${Math.round(80 * (1 - intensity))},${Math.round(80 * (1 - intensity))})` };
  } else {
    // Green — yield fell
    const g = 150 + Math.round(105 * intensity);
    const rb = Math.round(30 * (1 - intensity));
    return { bg: `rgba(${rb},${g},${rb},${0.12 + 0.5 * intensity})`, fg: `rgb(${Math.round(60 * (1 - intensity))},${g},${Math.round(60 * (1 - intensity))})` };
  }
}

function fmt(bps: number | null): string {
  if (bps === null) return "—";
  const sign = bps > 0 ? "+" : "";
  return `${sign}${bps.toFixed(0)}`;
}

export default function YieldHeatmap() {
  const [sortKey, setSortKey] = useState<Horizon | "label" | "current">("label");
  const { data, error, isLoading } = useSWR<YieldChangesResponse>("/api/yield-changes", fetcher, { refreshInterval: 3600_000 });

  const rows = data?.rows ?? [];
  const sorted = [...rows].sort((a, b) => {
    if (sortKey === "label") return a.label.localeCompare(b.label);
    if (sortKey === "current") return (b.current ?? -Infinity) - (a.current ?? -Infinity);
    const av = a.changes[sortKey] ?? -Infinity;
    const bv = b.changes[sortKey] ?? -Infinity;
    return bv - av;
  });

  return (
    <SectionCard
      label="F8"
      title="YIELD CHANGE HEATMAP"
      description="Basis-point yield changes across maturities and time horizons. RED = yields rose (bond prices fell). GREEN = yields fell (bond prices rose). Click column header to sort."
      rightLabel="bps"
    >
      {isLoading && <div className="skeleton" style={{ height: 300 }} />}
      {error && <p style={{ color: "var(--red)", fontFamily: "monospace" }}>ERR: Failed to load yield change data</p>}
      {data && (
        <>
          {/* Legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 10, alignItems: "center" }}>
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555555" }}>SORT BY:</span>
            {(["label", "current", ...HORIZONS] as const).map((k) => (
              <button key={k} onClick={() => setSortKey(k as typeof sortKey)}
                className={`terminal-btn ${sortKey === k ? "active" : ""}`}
                style={{ padding: "2px 8px", fontSize: 10 }}>
                {k === "label" ? "BOND" : k === "current" ? "YIELD" : k}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontFamily: "'Courier New', monospace", fontSize: 10, color: "var(--text-muted)" }}>
              ALL VALUES IN BASIS POINTS (bps = 0.01%)
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 580 }}>
              <thead>
                <tr style={{ background: "#0a0a0a" }}>
                  <th style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700, color: "var(--amber)",
                    textAlign: "left", padding: "6px 12px", borderRight: "1px solid #1a1a1a", letterSpacing: "0.08em", minWidth: 80 }}>
                    BOND
                  </th>
                  <th style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700, color: "var(--amber)",
                    textAlign: "right", padding: "6px 10px", borderRight: "1px solid #1a1a1a", letterSpacing: "0.06em" }}>
                    YIELD
                  </th>
                  {HORIZONS.map((h) => (
                    <th key={h} onClick={() => setSortKey(h)}
                      style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700,
                        textAlign: "right", padding: "6px 10px", cursor: "pointer", letterSpacing: "0.06em",
                        borderRight: "1px solid #1a1a1a",
                        color: sortKey === h ? "var(--amber)" : "var(--text-dim)" }}>
                      {h} ▼
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  // Add a visual separator between country groups
                  const prevRow = sorted[i - 1];
                  const country = row.id.slice(0, 2);
                  const prevCountry = prevRow?.id.slice(0, 2);
                  const isGroupStart = i > 0 && country !== prevCountry;

                  return (
                    <React.Fragment key={row.id}>
                      {isGroupStart && (
                        <tr>
                          <td colSpan={8} style={{ height: 1, background: "#1a1a1a", padding: 0 }} />
                        </tr>
                      )}
                      <HeatRow row={row} />
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Color legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#555555" }}>SCALE:</span>
            {[-80, -40, -10, 0, 10, 40, 80].map((v) => {
              const c = heatColor(v === 0 ? 0.001 : v);
              return (
                <div key={v} style={{ background: c.bg, padding: "2px 6px", borderRadius: 0 }}>
                  <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: c.fg }}>
                    {v > 0 ? "+" : ""}{v}
                  </span>
                </div>
              );
            })}
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#555555", marginLeft: 4 }}>bps</span>
          </div>
        </>
      )}
    </SectionCard>
  );
}

function HeatRow({ row }: { row: BondRow }) {
  return (
    <tr style={{ borderBottom: "1px solid #0f0f0f" }}>
      <td style={{ fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 700,
        color: "var(--amber)", padding: "5px 12px", borderRight: "1px solid #1a1a1a", whiteSpace: "nowrap" }}>
        {row.label}
      </td>
      <td style={{ fontFamily: "'Courier New', monospace", fontSize: 12, fontWeight: 700,
        color: "var(--text)", textAlign: "right", padding: "5px 10px", borderRight: "1px solid #1a1a1a" }}>
        {row.current !== null ? `${row.current.toFixed(2)}%` : "—"}
      </td>
      {HORIZONS.map((h) => {
        const val = row.changes[h];
        const { bg, fg } = heatColor(val);
        return (
          <td key={h} className="heat-cell" title={`${row.label} ${h}: ${val !== null ? val + " bps" : "N/A"}`}
            style={{ background: bg, color: fg, borderRight: "1px solid #0a0a0a" }}>
            {fmt(val)}
          </td>
        );
      })}
    </tr>
  );
}
