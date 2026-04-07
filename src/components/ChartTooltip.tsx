import React from "react";

interface TooltipPayloadItem {
  name: string;
  value: number | null;
  color: string;
  unit?: string;
}

interface Props {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  unit?: string;
}

export default function ChartTooltip({ active, payload, label, unit = "%" }: Props) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#0d0d0d",
        border: "1px solid #252525",
        borderRadius: 0,
        padding: "8px 12px",
        fontSize: 11,
        fontFamily: "'Courier New', monospace",
        minWidth: 160,
        boxShadow: "0 0 12px rgba(255,153,0,0.08)",
      }}
    >
      <div style={{ color: "#555555", marginBottom: 6, borderBottom: "1px solid #1a1a1a", paddingBottom: 4 }}>
        {label}
      </div>
      {payload.map((item, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 20, color: item.color, marginTop: 2 }}>
          <span style={{ color: "#888888" }}>{item.name}</span>
          <span style={{ fontWeight: 700 }}>
            {item.value !== null && item.value !== undefined
              ? `${item.value.toFixed(3)}${item.unit ?? unit}`
              : "N/A"}
          </span>
        </div>
      ))}
    </div>
  );
}
