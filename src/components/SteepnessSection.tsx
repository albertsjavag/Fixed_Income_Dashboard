"use client";
import React from "react";
import useSWR from "swr";
import SectionCard from "./SectionCard";
import type { SteepnessResponse, SteepnessEntry } from "@/pages/api/steepness";

import { fetcher } from "@/lib/fetcher";

const DIR_ICON: Record<SteepnessEntry["direction"], string> = {
  steeper: "▲", flatter: "▼", unchanged: "►", unavailable: "—",
};
const DIR_COLOR: Record<SteepnessEntry["direction"], string> = {
  steeper: "var(--green)", flatter: "var(--red)", unchanged: "var(--text-muted)", unavailable: "var(--text-muted)",
};

export default function SteepnessSection() {
  const { data, error, isLoading } = useSWR<SteepnessResponse>("/api/steepness", fetcher, { refreshInterval: 3600_000 });

  return (
    <SectionCard
      label="F4"
      title="CURVE STEEPNESS — 10Y MINUS 2Y"
      description="Positive = normal (term premium intact). Negative = inverted (banks under pressure, recession risk elevated). Direction vs last week shown."
      rightLabel="CURRENT"
    >
      {isLoading && <div className="skeleton" style={{ height: 120 }} />}
      {error && <p style={{ color: "var(--red)", fontFamily: "monospace" }}>ERR: Failed to load steepness data</p>}
      {data?.entries && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 2 }}>
          {data.entries.map((e) => <SteepCard key={e.country} entry={e} />)}
        </div>
      )}
    </SectionCard>
  );
}

function SteepCard({ entry }: { entry: SteepnessEntry }) {
  const na = entry.current === null || entry.direction === "unavailable";
  const bcolor = na ? "#1a1a1a" : entry.inverted ? "rgba(255,51,51,0.08)" : "rgba(0,204,68,0.06)";
  const border = na ? "var(--border)" : entry.inverted ? "rgba(255,51,51,0.3)" : "rgba(0,204,68,0.25)";

  return (
    <div style={{ background: bcolor, border: `1px solid ${border}`, padding: "14px 16px" }}>
      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, fontWeight: 700, color: "#555555", letterSpacing: "0.1em", marginBottom: 2 }}>
        {entry.country.toUpperCase()}
      </p>
      <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "var(--text-muted)", marginBottom: 10 }}>10Y − 2Y</p>

      {na ? (
        <p style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "var(--text-muted)" }}>
          {entry.country === "Germany" ? "SUB-10Y DATA UNAVAIL" : "N/A"}
        </p>
      ) : (
        <>
          <p style={{ fontFamily: "'Courier New', monospace", fontSize: 30, fontWeight: 900,
            color: entry.inverted ? "var(--red)" : "var(--green)", lineHeight: 1, letterSpacing: "-1px" }}>
            {entry.current !== null ? `${entry.current > 0 ? "+" : ""}${entry.current.toFixed(2)}%` : "—"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span className={`badge ${entry.inverted ? "badge-red" : "badge-green"}`}>
              {entry.inverted ? "INVERTED" : "NORMAL"}
            </span>
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: DIR_COLOR[entry.direction] }}>
              {DIR_ICON[entry.direction]}{" "}
              {entry.weekAgo !== null ? `${entry.weekAgo > 0 ? "+" : ""}${entry.weekAgo.toFixed(2)}% WK AGO` : ""}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
