# Fixed Income Dashboard

A full-stack dashboard for analysing sovereign government bond markets in Norway, Germany, and the United States. I built this project to deepen my understanding of fixed income markets and to practise working with real financial data end-to-end — from raw API responses to a live, deployed web application.

The frontend is built with Next.js and Recharts. The backend is a Python FastAPI service that fetches data from the [FRED API](https://fred.stlouisfed.org) and the [Norges Bank Open Data API](https://data.norges-bank.no), applies the calculations described below, and serves the results to the frontend. Data is cached for one hour so the FRED API key is never exposed to the browser.

**Live demo:** https://fi-dashboard.onrender.com

---

## What the dashboard shows

| Section | What it shows |
|---------|---------------|
| F1 — Implied Forward Rates | Where the market prices future interest rates |
| F2 — 10Y Yield History | How benchmark long-term rates have evolved |
| F3 — Spread Monitor | Relative value and recession indicators |
| F4 — Curve Steepness | Term premium and inversion risk |
| F5 — Z-Score | Whether current yields are statistically extreme |
| F6 — Rolling Correlation | Whether markets are moving together or diverging |
| F7 — Breakeven Inflation | Market-implied 10-year inflation expectation |
| F8 — Yield Change Heatmap | Basis-point moves across maturities and time horizons |
| F9 — Yield & Spread Matrix | Cross-country snapshot at a glance |
| F10 — Spread Calculator | Custom pair analysis across any two series |

---

## The mathematics

### 1. Implied forward rates

A spot yield $r(t)$ is the yield today on a zero-coupon bond maturing in $t$ years. The implied forward rate $f(t_1, t_2)$ is the rate the market is pricing for a loan that starts at $t_1$ and matures at $t_2$. It follows from a no-arbitrage argument applied to two spot rates:

$$f(t_1, t_2) = \frac{r(t_2) \cdot t_2 - r(t_1) \cdot t_1}{t_2 - t_1}, \qquad t_2 > t_1 \geq 0$$

I compute five forward rates for both the US and Norway: 3M→6M, 6M→1Y, 1Y→2Y, 2Y→5Y, and 5Y→10Y. The last one (the "5Y5Y") is widely watched by central banks as a measure of long-run rate expectations.

### 2. Yield spreads

A yield spread is the difference between two bond yields:

$$\text{Spread}_{A,B} = r_A - r_B$$

In the heatmap and matrix I express this in basis points, where one basis point equals 0.01%:

$$\Delta r_{\text{bps}} = (r_A - r_B) \times 100$$

The curve steepness is the 10Y minus 2Y spread. When negative, the curve is inverted — short-term rates exceed long-term ones. This has preceded every US recession since 1955.

### 3. Z-score

The z-score measures how far the current yield is from its one-year historical average in units of standard deviation. Let $\mu$ and $\sigma$ be the mean and standard deviation of daily yields over the past year:

$$z = \frac{r_{\text{current}} - \mu}{\sigma}$$

A z-score beyond ±2 is flagged as historically extreme. Norway and the US use daily data (~252 observations); Germany uses monthly data (~12 observations), which I flag as indicative only.

### 4. Rolling Pearson correlation

To measure how synchronised two yield markets are, I compute the Pearson correlation coefficient over a rolling window of $w$ days. A value near +1 means the two markets are moving in lockstep (global macro dominates). A sustained drop below 0.3 suggests a regime shift where domestic factors are overriding the global trend.

I track the 30-day and 90-day rolling correlation between Norwegian 10Y and US 10Y yields.

### 5. Breakeven inflation

Breakeven inflation is the market's implied forecast for average CPI inflation over the next 10 years. It is derived from the spread between a nominal Treasury and a TIPS bond of the same maturity:

$$\pi^* = r_{\text{nominal}}(10\text{Y}) - r_{\text{real}}(10\text{Y})$$

If realised inflation exceeds $\pi^*$, the TIPS investor outperforms; if it falls short, the nominal investor does. I draw a reference line at 2%, the Federal Reserve's inflation target.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Recharts, SWR |
| Backend | Python, FastAPI, httpx, numpy |
| Data | FRED API (US + Germany), Norges Bank SDMX-JSON API |
| Deployment | Render.com (Python API + Node frontend) |

---

## Data sources

| Market | Series | Frequency | Provider |
|--------|--------|-----------|----------|
| US 3M–10Y yields | DGS3MO, DGS6MO, DGS1, DGS2, DGS5, DGS10 | Daily | FRED |
| US 10Y breakeven | T10YIE | Daily | FRED |
| Germany 10Y | IRLTLT01DEM156N | Monthly | FRED |
| Norway 3M, 6M, 1Y | GOVT\_GENERIC\_RATES / TBIL | Daily | Norges Bank |
| Norway 5Y, 10Y | GOVT\_GENERIC\_RATES / GBON | Daily | Norges Bank |
| Norway 2Y | GOVT\_ZEROCOUPON | Daily | Norges Bank |

---

