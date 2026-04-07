import React from "react";

interface Props {
  label: string;       // e.g. "F1" or "S1"
  title: string;       // e.g. "YIELD CURVES"
  description: string;
  children: React.ReactNode;
  rightLabel?: string; // optional right-side status text
}

export default function SectionCard({ label, title, description, children, rightLabel }: Props) {
  return (
    <div className="card" style={{ marginBottom: 2 }}>
      {/* Terminal title bar */}
      <div className="card-titlebar">
        <div className="card-titlebar-left">
          <span className="card-fn-key">{label}</span>
          <span className="card-title-text">{title}</span>
        </div>
        {rightLabel && (
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, color: "var(--text-muted)" }}>
            {rightLabel}
          </span>
        )}
      </div>
      {/* Description line */}
      <div className="card-desc">{description}</div>
      {/* Body */}
      <div className="card-body">{children}</div>
    </div>
  );
}
