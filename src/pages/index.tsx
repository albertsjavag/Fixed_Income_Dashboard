import React, { useEffect, useState } from "react";
import Head from "next/head";
import ForwardRateSection from "@/components/ForwardRateSection";
import History10YSection from "@/components/History10YSection";
import SpreadSection from "@/components/SpreadSection";
import SteepnessSection from "@/components/SteepnessSection";
import ZScoreSection from "@/components/ZScoreSection";
import CorrelationSection from "@/components/CorrelationSection";
import BreakevenSection from "@/components/BreakevenSection";
import YieldHeatmap from "@/components/YieldHeatmap";
import SpreadCalculator from "@/components/SpreadCalculator";
import SpreadMatrix from "@/components/SpreadMatrix";

// Blinking cursor component
function Cursor() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), 600);
    return () => clearInterval(id);
  }, []);
  return <span style={{ opacity: on ? 1 : 0, color: "var(--amber)" }}>█</span>;
}

function Clock() {
  const [time, setTime] = useState("");
  const [date, setDate] = useState("");
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-GB", { hour12: false }));
      setDate(now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase());
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ textAlign: "right", fontFamily: "'Courier New', monospace" }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: "var(--amber)", letterSpacing: "0.05em", lineHeight: 1 }}>{time}</div>
      <div style={{ fontSize: 10, color: "#555555", letterSpacing: "0.08em" }}>{date}</div>
    </div>
  );
}

const SECTIONS = [
  { key: "F1", label: "YCRV" },
  { key: "F2", label: "HIST" },
  { key: "F3", label: "SPRD" },
  { key: "F4", label: "STEP" },
  { key: "F5", label: "ZSCR" },
  { key: "F6", label: "CORR" },
  { key: "F7", label: "BRKV" },
  { key: "F8", label: "HEAT" },
  { key: "F9", label: "CALC" },
  { key: "F10", label: "MTRX" },
];

export default function Dashboard() {
  return (
    <>
      <Head>
        <title>FIXED INCOME TERMINAL</title>
        <meta name="description" content="Professional fixed income dashboard: yield curves, spreads, z-scores, and breakeven inflation." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div style={{ minHeight: "100vh", background: "var(--bg)", paddingBottom: 40 }}>

        {/* ── Status bar (top) ── */}
        <div style={{
          background: "var(--amber)",
          padding: "2px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: 900, color: "#000", letterSpacing: "0.1em" }}>
            FIXED INCOME TERMINAL
          </span>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#000", letterSpacing: "0.05em" }}>
            DATA: FRED · NORGES BANK · CACHED 1H
          </span>
        </div>

        {/* ── Main header ── */}
        <header style={{
          borderBottom: "1px solid var(--border)",
          padding: "12px 16px",
          background: "var(--surface)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ maxWidth: 1440, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            {/* Left: Title + market labels */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 3, height: 28, background: "var(--amber)", flexShrink: 0 }} />
                <div>
                  <p style={{ fontFamily: "'Courier New', monospace", fontSize: 18, fontWeight: 900, color: "var(--amber)", letterSpacing: "0.06em", lineHeight: 1 }}>
                    SOVEREIGN YIELD DASHBOARD <Cursor />
                  </p>
                  <p style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#555555", letterSpacing: "0.08em", marginTop: 2 }}>
                    NORWAY · GERMANY · UNITED STATES
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Clock */}
            <Clock />
          </div>

          {/* Function key bar */}
          <div style={{ maxWidth: 1440, margin: "10px auto 0", display: "flex", gap: 2, flexWrap: "wrap" }}>
            {SECTIONS.map((s) => (
              <div key={s.key} style={{ display: "flex", alignItems: "stretch" }}>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#333333",
                  background: "#0a0a0a", padding: "2px 4px", borderTop: "1px solid #1a1a1a",
                  borderLeft: "1px solid #1a1a1a", borderBottom: "1px solid #1a1a1a" }}>
                  {s.key}
                </span>
                <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#888888",
                  background: "#111111", padding: "2px 6px", border: "1px solid #1a1a1a" }}>
                  {s.label}
                </span>
              </div>
            ))}
            <span style={{ fontFamily: "'Courier New', monospace", fontSize: 9, color: "#333333",
              marginLeft: "auto", alignSelf: "center" }}>
              NOT INVESTMENT ADVICE
            </span>
          </div>
        </header>

        {/* ── Main content ── */}
        <main style={{ maxWidth: 1440, margin: "2px auto 0", padding: "0 0" }}>
          <ForwardRateSection />
          <History10YSection />
          <SpreadSection />
          <SteepnessSection />
          <ZScoreSection />
          <CorrelationSection />
          <BreakevenSection />
          <YieldHeatmap />
          <SpreadMatrix />
          <SpreadCalculator />
        </main>

        {/* ── Footer status bar ── */}
        <div style={{
          maxWidth: 1440,
          margin: "2px auto 0",
          padding: "4px 12px",
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 24,
          alignItems: "center",
        }}>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "var(--text-muted)" }}>
            SRC:{" "}
            <a href="https://fred.stlouisfed.org" target="_blank" rel="noopener noreferrer"
              style={{ color: "#444444" }}>FRED/STL</a>
            {" "}·{" "}
            <a href="https://data.norges-bank.no" target="_blank" rel="noopener noreferrer"
              style={{ color: "#444444" }}>NORGES BANK</a>
          </span>
          <span style={{ fontFamily: "'Courier New', monospace", fontSize: 10, color: "#222222", marginLeft: "auto" }}>
            CACHE TTL: 3600s · DATA MAY BE DELAYED
          </span>
        </div>
      </div>
    </>
  );
}
