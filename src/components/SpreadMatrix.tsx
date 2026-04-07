"use client";
// Section F10: Current Yield Matrix
// Shows current yields for all available bonds in a compact table,
// plus a cross-country spread matrix (NO−US, NO−DE, US−DE) per maturity.
import React from "react";
import useSWR from "swr";
import SectionCard from "./SectionCard";
import { CT } from "@/lib/chartTheme";
import type { YieldChangesResponse, BondRow } from "@/pages/api/yield-changes";

import { fetcher } from "@/lib/fetcher";

const COUNTRY_COLOR: Record<string, string> = {
  US: CT.us,
  NO: CT.norway,
  DE: CT.germany,
};

const SHARED_MATURITIES = ["10Y"]; // Only DE 10Y exists; full matrix only for US + NO
const US_NO_MATURITIES = ["3M", "6M", "1Y", "2Y", "5Y", "10Y"];

function spreadColor(bps: number | null): { color: string; bg: string } {
  if (bps === null) return { color: "#333333", bg: "transparent" };
  const abs = Math.abs(bps);
  if (abs < 10) return { color: "#888888", bg: "transparent" };
  if (bps > 0) return { color: `rgba(${Math.min(255, 100 + abs)}, ${Math.max(0, 150 - abs)}, 80, 1)`, bg: "transparent" };
  return { color: `rgba(80, ${Math.min(255, 150 + abs)}, 100, 1)`, bg: "transparent" };
}

export default function SpreadMatrix() {
  const { data, error, isLoading } = useSWR<YieldChangesResponse>("/api/yield-changes", fetcher, { refreshInterval: 3600_000 });

  const rowMap = new Map<string, BondRow>();
  data?.rows.forEach((r) => rowMap.set(r.id, r));

  function getYield(id: string): number | null {
    return rowMap.get(id)?.current ?? null;
  }

  function spreadBps(idA: string, idB: string): number | null {
    const a = getYield(idA);
    const b = getYield(idB);
    if (a === null || b === null) return null;
    return parseFloat(((a - b) * 100).toFixed(1));
  }

  return (
    <SectionCard
      label="F9"
      title="YIELD & SPREAD MATRIX"
      description="Current yields for all bonds and cross-country spreads per maturity. Positive spread = first country yields higher. All spreads in basis points (bps)."
      rightLabel="CURRENT"
    >
      {isLoading && <div className="skeleton" style={{ height: 260 }} />}
      {error && <p style={{ color: "var(--red)", fontFamily: "monospace" }}>ERR: Failed to load yield data</p>}
      {data && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>

          {/* Left: Current yields table */}
          <div style={{ overflowX: "auto" }}>
            <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555555", letterSpacing: "0.1em",
              fontWeight: 700, marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #1a1a1a" }}>
              CURRENT YIELDS
            </p>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>MAT</th>
                  {(["US", "NO", "DE"] as const).map((c) => (
                    <th key={c} style={{ ...thStyle, color: COUNTRY_COLOR[c] }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {US_NO_MATURITIES.map((mat) => {
                  const usId = `US_${mat}`;
                  const noId = `NO_${mat}`;
                  const deId = mat === "10Y" ? "DE_10Y" : null;
                  return (
                    <tr key={mat} style={{ borderBottom: "1px solid #0f0f0f" }}>
                      <td style={{ ...tdStyle, color: "var(--amber)", textAlign: "left", fontWeight: 700 }}>{mat}</td>
                      <YieldCell value={getYield(usId)} color={CT.us} />
                      <YieldCell value={getYield(noId)} color={CT.norway} />
                      <YieldCell value={deId ? getYield(deId) : null} color={CT.germany} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Right: Spread matrix */}
          <div style={{ overflowX: "auto" }}>
            <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555555", letterSpacing: "0.1em",
              fontWeight: 700, marginBottom: 6, paddingBottom: 4, borderBottom: "1px solid #1a1a1a" }}>
              SPREADS (bps)  A−B
            </p>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: "left" }}>MAT</th>
                  <th style={{ ...thStyle }}>NO−US</th>
                  <th style={{ ...thStyle }}>NO−DE</th>
                  <th style={{ ...thStyle }}>US−DE</th>
                </tr>
              </thead>
              <tbody>
                {US_NO_MATURITIES.map((mat) => {
                  const noId = `NO_${mat}`;
                  const usId = `US_${mat}`;
                  const deId = mat === "10Y" ? "DE_10Y" : null;
                  const noUs = spreadBps(noId, usId);
                  const noDe = deId ? spreadBps(noId, deId) : null;
                  const usDe = deId ? spreadBps(usId, deId) : null;
                  return (
                    <tr key={mat} style={{ borderBottom: "1px solid #0f0f0f" }}>
                      <td style={{ ...tdStyle, color: "var(--amber)", textAlign: "left", fontWeight: 700 }}>{mat}</td>
                      <SpreadCell bps={noUs} />
                      <SpreadCell bps={noDe} />
                      <SpreadCell bps={usDe} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="note" style={{ marginTop: 10 }}>⚠ DE spreads available at 10Y only (monthly series)</p>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

const thStyle: React.CSSProperties = {
  fontFamily: "'Courier New', monospace",
  fontSize: 10,
  fontWeight: 700,
  color: "var(--text-muted)",
  textAlign: "right",
  padding: "4px 10px",
  letterSpacing: "0.06em",
  borderBottom: "1px solid #1a1a1a",
};

const tdStyle: React.CSSProperties = {
  fontFamily: "'Courier New', monospace",
  fontSize: 12,
  textAlign: "right",
  padding: "4px 10px",
};

function YieldCell({ value, color }: { value: number | null; color: string }) {
  return (
    <td style={{ ...tdStyle, color: value !== null ? color : "#333333", fontWeight: 700 }}>
      {value !== null ? `${value.toFixed(2)}%` : "—"}
    </td>
  );
}

function SpreadCell({ bps }: { bps: number | null }) {
  const { color } = spreadColor(bps);
  const sign = bps !== null && bps > 0 ? "+" : "";
  return (
    <td style={{ ...tdStyle, color, fontWeight: 700 }}>
      {bps !== null ? `${sign}${bps.toFixed(0)}` : "—"}
    </td>
  );
}
