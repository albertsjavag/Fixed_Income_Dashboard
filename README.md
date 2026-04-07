# Fixed Income Dashboard

A full-stack dashboard for analysing sovereign government bond markets in Norway, Germany, and the United States. I built this project to deepen my understanding of fixed income markets and to practise working with real financial data end-to-end — from raw API responses to a live, deployed web application.

The frontend is built with Next.js and Recharts. The backend is a Python FastAPI service that fetches data from the [FRED API](https://fred.stlouisfed.org) and the [Norges Bank Open Data API](https://data.norges-bank.no), applies the calculations described below, and serves the results to the frontend. Data is cached for one hour so the FRED API key is never exposed to the browser.

**Live demo:** https://fi-dashboard.onrender.com

---

## What the dashboard shows

Fixed income markets are the largest financial markets in the world. Unlike equities, bonds have a defined maturity structure — the same government borrows at many different tenors simultaneously (3 months, 2 years, 10 years, etc.). The shape of this term structure, and how it changes over time, encodes a lot of information about what markets expect for growth, inflation, and central bank policy.

I built ten analytical sections around this idea:

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

A spot yield $r(t)$ is the yield today on a zero-coupon bond maturing in $t$ years. If I invest \$1 for two years at the 2-year spot rate, I should earn the same as investing for one year at the 1-year spot rate and then reinvesting for another year — otherwise there would be an arbitrage. This no-arbitrage condition lets me back out the **implied forward rate** $f(t_1, t_2)$, which is the rate the market is implicitly pricing for a loan that starts at time $t_1$ and matures at $t_2$.

Let $r(t_1)$ and $r(t_2)$ denote the spot yields at maturities $t_1$ and $t_2$ respectively, with $t_2 > t_1 \geq 0$. Under continuous compounding, the forward rate is

$$
f(t_1,\, t_2) = \frac{r(t_2)\cdot t_2 - r(t_1)\cdot t_1}{t_2 - t_1}
$$

This is a continuous compounding approximation, which works well for par yields when the two maturities are not too close together. I compute five forward rates for both the US and Norway:

| Label | $t_1$ | $t_2$ | Interpretation |
|-------|--------|--------|----------------|
| 3M→6M | 0.25Y | 0.5Y | Near-term policy expectation |
| 6M→1Y | 0.5Y | 1Y | 6-month rate in 6 months |
| 1Y→2Y | 1Y | 2Y | Rate in 1 year — primary policy horizon |
| 2Y→5Y | 2Y | 5Y | Medium-term rate path |
| 5Y→10Y | 5Y | 10Y | The "5Y5Y" — long-run terminal rate anchor |

The 5Y5Y forward is particularly closely watched by central banks. Because it starts five years from now, it is largely free of near-term monetary policy noise and is often interpreted as the market's view of where rates will settle in the long run.

---

### 2. Yield spreads

A yield spread is simply the arithmetic difference between two bond yields. Let $r_A(t)$ and $r_B(t)$ denote the yields on bonds A and B at time $t$. The spread is

$$
\text{Spread}_{A,B}(t) = r_A(t) - r_B(t)
$$

Spreads are shown in percentage points in charts and in basis points in the matrix, where one basis point equals one hundredth of a percentage point:

$$
\Delta r_{\text{bps}} = \bigl(r_A - r_B\bigr) \times 100
$$

A particularly important spread in fixed income is the 2Y–10Y slope, which I call the curve steepness:

$$
\text{Steepness} = r(10\text{Y}) - r(2\text{Y})
$$

When this quantity is positive, the yield curve is described as normal — long-term borrowing costs more than short-term, which is the usual state. When it turns negative, the curve is said to be inverted. Banks borrow short and lend long, so an inverted curve compresses their net interest margins and historically signals tighter credit conditions. The US 2Y–10Y spread has inverted before every recession since 1955.

---

### 3. Yield changes in basis points

The heatmap section shows how much each yield has moved over a set of time horizons, expressed in basis points. Let $r(t_0)$ and $r(t_1)$ be the yields at the start and end of the horizon. The change is

$$
\Delta r = \bigl[r(t_1) - r(t_0)\bigr] \times 100 \quad \text{(bps)}
$$

One thing worth noting about sign convention in fixed income: a rise in yield corresponds to a fall in bond price. So in the heatmap I colour positive changes red (yields rose, prices fell) and negative changes green (yields fell, prices rose), which is the opposite of the convention in equity markets.

---

### 4. Z-score — relative yield level

The z-score answers the question: how unusual is the current yield relative to recent history? Let $r_{\text{current}}$ be today's yield and let $r_1, r_2, \ldots, r_N$ be the daily observations over the past year. I compute the sample mean

$$
\mu = \frac{1}{N} \sum_{i=1}^{N} r_i
$$

and the population standard deviation

$$
\sigma = \sqrt{\frac{1}{N} \sum_{i=1}^{N} \left(r_i - \mu\right)^2}
$$

The z-score is then

$$
z = \frac{r_{\text{current}} - \mu}{\sigma}
$$

A z-score of $+2$ means the current yield is two standard deviations above its one-year average — historically high. I colour-code the result as follows:

$$
z \begin{cases}
\geq +2 & \text{Historically high (red)} \\
\in [+1,\,+2) & \text{Slightly elevated (yellow)} \\
\in (-1,\,+1) & \text{Near average (green)} \\
\in (-2,\,-1] & \text{Slightly depressed (yellow)} \\
\leq -2 & \text{Historically low (red)}
\end{cases}
$$

Norway and the US use daily data (~252 observations per year), so the z-score is statistically meaningful. Germany only has monthly data (~12 observations per year), so I flag it as indicative.

---

### 5. Rolling Pearson correlation

To measure how synchronised two yield markets are, I compute the Pearson correlation coefficient over a rolling window. Let $r_A^i$ and $r_B^i$ denote the yields of series A and B on day $i$, and let $\bar{r}_A$ and $\bar{r}_B$ be their within-window means. The correlation over a window of $w$ days ending at time $t$ is

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

I offer two window sizes: 30 days (sensitive to recent changes) and 90 days (smoother). The dashboard computes correlation between Norwegian 10Y and US 10Y yields. When correlation stays near $+1$, global macro factors are driving both markets. A sustained drop below $0.3$ suggests a regime shift — domestic factors are overriding the global trend.

---

### 6. Breakeven inflation

Breakeven inflation is the market's implied forecast for average annual CPI inflation over the next 10 years. It comes from comparing a nominal government bond with an inflation-linked bond of the same maturity. Let $r_{\text{nominal}}$ be the yield on a regular 10-year Treasury and $r_{\text{real}}$ be the yield on a 10-year TIPS (inflation-protected security). The breakeven rate is

$$
\pi^* = r_{\text{nominal}}(10\text{Y}) - r_{\text{real}}(10\text{Y})
$$

Intuitively, $\pi^*$ is the constant inflation rate that would make a nominal and a real bond deliver the same return. If realised inflation turns out to be higher than $\pi^*$, the TIPS investor wins; if lower, the nominal investor wins. FRED publishes this directly as the series `T10YIE`.

I draw a horizontal reference line at 2%, the Federal Reserve's inflation target. Sustained readings above 2% indicate that the market does not believe the Fed will fully control inflation.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (Pages Router), React, Recharts, SWR |
| Backend | Python, FastAPI, httpx, numpy |
| Data | FRED API (US + Germany), Norges Bank SDMX-JSON API |
| Deployment | Render.com (two services: Python API + Node frontend) |

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

## Known data limitations

| Limitation | Reason |
|-----------|--------|
| German yield curve has only 10Y | Only IRLTLT01DEM156N (monthly) is available on FRED. Sub-10Y German data requires ECB institutional access. |
| German steepness unavailable | No daily 2Y German series exists on any free public API. |
| German excluded from rolling correlation | Monthly frequency is incompatible with 30d/90d rolling windows on daily data. |
| German z-score is indicative | Based on ~12 monthly observations per year instead of ~252 daily. Flagged in the UI. |
| Norwegian and German breakeven unavailable | No free daily market-implied breakeven series exists for either country. |

---

## Local setup

```bash
git clone https://github.com/albertsjavag/Fixed_Income_Dashboard.git
cd Fixed_Income_Dashboard
```

**Backend:**
```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
# create .env with FRED_API_KEY=your_key
.venv/bin/uvicorn main:app --reload --port 8000
```

**Frontend:**
```bash
# in root directory
# create .env.local with NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev   # http://localhost:3000
```

A free FRED API key can be obtained at [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html).
