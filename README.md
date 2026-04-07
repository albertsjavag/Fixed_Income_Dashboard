# Fixed Income Dashboard

A professional fixed income dashboard for analysing sovereign government bond markets in **Norway**, **Germany**, and the **United States**. Built as a portfolio project to demonstrate quantitative fixed income analysis on real market data.

Data is sourced from the [FRED API](https://fred.stlouisfed.org) (Federal Reserve Bank of St. Louis) and the [Norges Bank Open Data API](https://data.norges-bank.no), fetched server-side and cached for one hour. No data is ever exposed directly to the browser.

---

## What this project analyses

Fixed income markets are the largest financial markets in the world. Unlike equities, bonds have a defined maturity structure — meaning the same issuer (e.g. the US Treasury) borrows at many different tenors simultaneously. The shape of this term structure, and how it changes over time, carries rich information about market expectations for growth, inflation, and monetary policy.

This dashboard extracts and visualises seven distinct signals from sovereign yield curves:

| Section | Signal |
|---------|--------|
| F1 — Implied Forward Rates | Where the market prices future interest rates |
| F2 — 10Y Yield History | How benchmark long rates have evolved |
| F3 — Spread Monitor | Relative value and recession indicators |
| F4 — Curve Steepness | Term premium and inversion risk |
| F5 — Z-Score | Whether current yields are statistically extreme |
| F6 — Rolling Correlation | Whether markets are in synchrony or diverging |
| F7 — Breakeven Inflation | Market-implied 10-year inflation expectation |
| F8 — Yield Change Heatmap | Basis-point moves across maturities and horizons |
| F9 — Spread Calculator | Custom pair analysis across any two series |
| F10 — Yield & Spread Matrix | Cross-country snapshot at a glance |

---

## Mathematics

### 1. Implied Forward Rates (Section F1)

A spot yield $r(t)$ is the yield today on a zero-coupon bond maturing in $t$ years. The **implied forward rate** $f(t_1, t_2)$ is the rate the market is implicitly pricing for a loan that begins at time $t_1$ and matures at $t_2$. It is derived from two spot rates via a no-arbitrage argument:

$$
f(t_1,\, t_2)
=
\frac{r(t_2)\cdot t_2 \;-\; r(t_1)\cdot t_1}{t_2 - t_1}
\qquad t_2 > t_1 \geq 0
$$

This is the **continuous compounding approximation**, which is accurate for par yields (the quoted convention for government bonds) when maturities are not too close together.

Five key forward rates are displayed:

| Label | From $t_1$ | To $t_2$ | Interpretation |
|-------|-----------|---------|----------------|
| 3M→6M | 0.25Y | 0.5Y | Near-term policy expectation |
| 6M→1Y | 0.5Y | 1Y | 6-month rate in 6 months |
| 1Y→2Y | 1Y | 2Y | Rate in 1 year — primary policy horizon |
| 2Y→5Y | 2Y | 5Y | Medium-term rate path |
| 5Y→10Y | 5Y | 10Y | The "5Y5Y" — long-run terminal rate anchor |

The 5Y5Y forward is particularly closely watched by central banks as a measure of long-run inflation and growth expectations, since it is far enough in the future to be largely free of near-term monetary policy noise.

---

### 2. Yield Spread (Sections F3, F9, F10)

A yield spread is the simple arithmetic difference between two bond yields:

$$
\text{Spread}_{A,B}(t) = r_A(t) - r_B(t)
$$

Spreads are expressed in **percentage points** in charts and in **basis points** (bps) in the matrix, where:

$$
1 \text{ basis point} = 0.01\%
\qquad \Longleftrightarrow \qquad
\Delta r_{\text{bps}} = \bigl(r_A - r_B\bigr) \times 100
$$

**Curve inversion** (Section F4) refers specifically to the 2Y–10Y spread:

$$
\text{Steepness} = r(10\text{Y}) - r(2\text{Y})
$$

When this quantity is negative, short-term borrowing costs exceed long-term ones. Banks borrow short and lend long, so an inverted curve compresses net interest margins and historically precedes economic contraction. This spread has inverted before every US recession since 1955.

---

### 3. Yield Change in Basis Points (Section F8)

The heatmap shows how much each yield has moved over a given horizon, expressed in basis points:

$$
\Delta r(t_0,\, t_1) = \bigl[r(t_1) - r(t_0)\bigr] \times 100 \quad \text{(bps)}
$$

Note the sign convention: in fixed income, a **rise in yield means a fall in bond price**. The heatmap is therefore coloured red for positive changes (yields rose, prices fell) and green for negative changes (yields fell, prices rose) — the opposite of the equity convention.

---

### 4. Z-Score — Relative Yield Level (Section F5)

The z-score measures how far the current yield is from its recent historical average in units of standard deviation:

$$
z = \frac{r_{\text{current}} - \mu}{\sigma}
$$

where the mean and standard deviation are computed over a **1-year rolling lookback window** of $N$ daily observations:

$$
\mu = \frac{1}{N} \sum_{i=1}^{N} r_i
\qquad
\sigma = \sqrt{\frac{1}{N} \sum_{i=1}^{N} \left(r_i - \mu\right)^2}
$$

The signal is colour-coded by magnitude:

$$
z \begin{cases}
\geq +2 & \text{Historically high (red)} \\
\in [+1,\,+2) & \text{Slightly elevated (yellow)} \\
\in (-1,\,+1) & \text{Near average (green)} \\
\in (-2,\,-1] & \text{Slightly depressed (yellow)} \\
\leq -2 & \text{Historically low (red)}
\end{cases}
$$

A sparkline shows the z-score trend over the trailing 3 months, making it easy to spot whether an extreme reading is new or has persisted.

> **Data quality note.** Norwegian and US z-scores are based on ~252 daily observations (one trading year). The German z-score uses monthly FRED data (IRLTLT01DEM156N), yielding only ~12 observations per year — the result is indicative rather than statistically robust, and is flagged accordingly in the UI.

---

### 5. Rolling Pearson Correlation (Section F6)

The **Pearson correlation coefficient** between two yield series $A$ and $B$ over a rolling window of $w$ trading days ending at time $t$ is:

$$
\rho_{AB}(t,\,w)
=
\frac{
    \displaystyle\sum_{i=t-w+1}^{t}
    \bigl(r_A^i - \bar{r}_A\bigr)\bigl(r_B^i - \bar{r}_B\bigr)
}{
    \sqrt{
        \displaystyle\sum_{i=t-w+1}^{t}\bigl(r_A^i - \bar{r}_A\bigr)^2
        \;\cdot\;
        \displaystyle\sum_{i=t-w+1}^{t}\bigl(r_B^i - \bar{r}_B\bigr)^2
    }
}
\quad \in [-1,\, 1]
$$

where $\bar{r}_A$ and $\bar{r}_B$ are the within-window sample means.

Two window sizes are offered: **30 days** (sensitive to recent shifts) and **90 days** (smoother, less reactive to noise).

The dashboard computes correlation between **Norwegian 10Y** and **US 10Y** yields. When correlation is near $+1$, global macro factors (Fed policy expectations, risk sentiment) dominate both markets. A sustained drop below $0.3$ — highlighted in the chart — signals a **regime shift**: domestic factors are overriding the global trend. This has historically coincided with periods of divergent monetary policy cycles or idiosyncratic country risk events.

---

### 6. Breakeven Inflation (Section F7)

Breakeven inflation is the market's implied forecast for average annual CPI inflation over the next 10 years. It is derived from the spread between a nominal government bond and an inflation-linked bond of the same maturity:

$$
\pi^* = r_{\text{nominal}}(10\text{Y}) - r_{\text{real}}(10\text{Y})
$$

For the United States, this is directly published by FRED as the **10-Year Breakeven Inflation Rate** (series `T10YIE`), which uses TIPS (Treasury Inflation-Protected Securities) as the real yield reference.

Mechanically, $\pi^*$ is the constant inflation rate that equalises the returns of a nominal and an inflation-linked bond. If realised inflation exceeds $\pi^*$, the TIPS holder outperforms; if it falls short, the nominal holder does.

A horizontal reference line at **2%** marks the Federal Reserve's symmetric inflation target. Sustained readings above 2% indicate markets believe the Fed will undershoot its mandate (or that the target itself is not credible).

> **Availability.** German breakeven inflation requires ECB inflation-linked bond data, which is not available via free public APIs. Norwegian breakeven inflation is not published as a market-implied rate by Norges Bank (the NGB-IL market is too thinly traded for a reliable daily series). Both limitations are noted in the UI.

---

## Data sources and series IDs

| Market | Series | Frequency | Provider |
|--------|--------|-----------|----------|
| US 3M–10Y yields | DGS3MO, DGS6MO, DGS1, DGS2, DGS5, DGS10 | Daily | FRED |
| US 10Y breakeven | T10YIE | Daily | FRED |
| US 10Y real yield | DFII10 | Daily | FRED |
| Germany 10Y | IRLTLT01DEM156N | Monthly | FRED |
| Norway 3M, 6M, 1Y | GOVT\_GENERIC\_RATES / TBIL | Daily | Norges Bank |
| Norway 5Y, 10Y | GOVT\_GENERIC\_RATES / GBON | Daily | Norges Bank |
| Norway 2Y | GOVT\_ZEROCOUPON | Daily | Norges Bank |

---

## Local setup

### Prerequisites

- Node.js 18+
- A free [FRED API key](https://fred.stlouisfed.org/docs/api/api_key.html)

### Install and run

```bash
git clone <repo-url>
cd Fixed_Income_Dashboard
npm install
```

Create `.env.local`:

```env
FRED_API_KEY=your_key_here
```

```bash
npm run dev   # http://localhost:3000
```

## Deploying on Render

| Field | Value |
|-------|-------|
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Environment variable | `FRED_API_KEY` = your FRED API key |

The in-memory cache resets on each server restart. On Render's free tier the server may spin down between requests — the first request after a cold start will re-fetch all upstream data.

---

## Known data limitations

| Limitation | Reason |
|-----------|--------|
| German yield curve has only 10Y | Only IRLTLT01DEM156N (monthly) is available on FRED. Sub-10Y German data requires ECB institutional access. |
| German steepness unavailable | No daily 2Y German series exists on any free public API. |
| German excluded from rolling correlation | Monthly frequency is incompatible with 30d/90d rolling windows on daily data (~24 matched dates over 2 years). |
| German z-score is indicative | Based on ~12 monthly observations per year instead of ~252 daily. Flagged in the UI. |
| Norwegian and German breakeven unavailable | No free daily market-implied breakeven series exists for either country. |
