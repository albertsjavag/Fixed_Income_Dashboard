# Fixed Income Dashboard

I built this as a portfolio project to get experience with fixed income markets. The idea was to go beyond theory and actually work with real yield data, fetching it, cleaning it, running calculations on it, and presenting the results in a way that makes sense to someone with a finance
background.                                                     

The dashboard tracks sovereign government bond markets for Norway, Germany, and the United States. The frontend is built with Next.js and Recharts. The backend is a Python FastAPI service that pulls data from the FRED API and the Norges Bank Open Data API, does the number crunching, and sends the results to the frontend. Everything is cached for an hour so the API keys stay on the server and never reach the browser.

**Live demo:** https://fi-dashboard.onrender.com

---

# Author
- Albert Sjåvåg 
- BSc in Quantitative Finance | University of Oslo
- Email: albert.sjaavaag@gmail.com

Github repo link: https://github.com/albertsjavag/Fixed_Income_Dashboard


## What the dashboard shows

### F1 — Implied Forward Rates

The spot yield curve tells you what it costs to borrow today at different maturities. Forward rates go one step further: they extract what the market is implicitly pricing for interest rates at a future point in time. A rising forward curve means markets expect rates to keep climbing; a declining one means rate cuts are priced in. The 5Y→10Y forward (the "5Y5Y") is particularly important — central banks watch it as a measure of long-run neutral rate expectations.

### F2 — 10Y Yield History

The 10-year yield is the benchmark rate in fixed income. Mortgages, corporate bonds, and government debt are all priced relative to it. This section plots two years of 10Y yields for Norway, the US, and Germany on a single chart, making it easy to see when markets move together (global risk-off, shared central bank cycles) and when they diverge (different domestic monetary policy paths).

### F3 — Spread Monitor

A spread is the difference between two yields. I track three: Norway 10Y minus US 10Y (cross-country relative value), US 2Y minus US 10Y (the classic recession indicator), and Norway 2Y minus Norway 10Y (same signal for Norway). When the 2Y–10Y spread turns negative, short-term borrowing costs exceed long-term ones. Banks fund themselves short and lend long, so an inversion compresses their margins — historically a leading indicator of economic slowdown.

### F4 — Curve Steepness

This isolates the 10Y minus 2Y spread as a single number. Positive means a normal curve (term premium intact). Negative means the curve is inverted (banks under pressure, credit tightening). I show the current reading, whether it is inverted, and whether it has steepened or flattened compared to a week ago.

### F5 — Z-Score

The z-score answers: is the current yield historically cheap or expensive? I compute the mean and standard deviation of yields over the trailing year and express today's yield in units of standard deviation. A reading beyond ±2 is flagged as historically extreme and is a potential mean-reversion signal. Norway and the US use daily data (~252 observations per year); Germany uses monthly (~12), which I flag as indicative.

### F6 — Rolling Correlation

This measures how synchronised Norwegian and US 10Y yields are over 30-day and 90-day rolling windows. When correlation is near +1, global macro factors are driving both markets — Fed expectations and risk sentiment dominate. A sustained drop below 0.3 is highlighted as a regime shift: domestic factors are overriding the global trend, which has historically coincided with diverging central bank cycles or country-specific risk events.

### F7 — Breakeven Inflation

Breakeven inflation is the market's implied forecast for average annual CPI over the next 10 years. It is derived from the spread between a nominal Treasury yield and a TIPS (inflation-protected) yield. If you believe inflation will exceed this number, you should own TIPS; if you think it will undershoot, you should own nominal bonds. I show US breakeven against the Fed's 2% target. German and Norwegian breakeven rates are unavailable via free public APIs.

### F8 — Yield Change Heatmap

A matrix showing how much each yield has moved over six time horizons (1 day, 1 week, 1 month, 3 months, 6 months, 1 year), expressed in basis points. Red means yields rose (bond prices fell); green means yields fell (bond prices rose). This is the opposite of the equity convention. The heatmap makes it easy to spot which part of which curve is moving most and over what horizon.

### F9 — Yield & Spread Matrix

A snapshot table showing current yields for all maturities and countries, alongside a cross-country spread matrix in basis points. It gives an at-a-glance view of where each market stands relative to the others — the kind of summary a trader or analyst would check first thing in the morning.

### F10 — Spread Calculator

An interactive tool for custom pair analysis. Select any two of the 13 available series (US, Norway, and Germany across maturities) and choose a time window. The chart shows both yields on the left axis and their spread on the right axis, making it easy to analyse relative value — for example, whether the Norway–US 10Y spread is wide or tight relative to its own recent history.

---

## The mathematics

**Implied forward rate** — derived from two spot yields via a no-arbitrage condition:

$$f(t_1, t_2) = \frac{r(t_2) \cdot t_2 - r(t_1) \cdot t_1}{t_2 - t_1}, \qquad t_2 > t_1 \geq 0$$

**Yield spread** — the difference between two bond yields, expressed in percentage points or basis points (1 bps = 0.01%):

$$\text{Spread}_{A,B} = r_A - r_B \qquad \Delta r_{\text{bps}} = (r_A - r_B) \times 100$$

**Yield change** — how much a yield has moved over a given horizon, in basis points:

$$\Delta r = \bigl[r(t_1) - r(t_0)\bigr] \times 100$$

**Z-score** — how many standard deviations the current yield is from its one-year mean:

$$z = \frac{r_{\text{current}} - \mu}{\sigma}$$

**Pearson correlation** — computed over a rolling window of $w$ days to measure how synchronised two yield series are:

$$\rho_{AB}(t,w) = \frac{\sum_{i=t-w+1}^{t}(r_A^i - \bar{r}_A)(r_B^i - \bar{r}_B)}{\sqrt{\sum_{i=t-w+1}^{t}(r_A^i - \bar{r}_A)^2 \cdot \sum_{i=t-w+1}^{t}(r_B^i - \bar{r}_B)^2}}$$

**Breakeven inflation** — the market's implied 10-year inflation forecast, derived from nominal and real yields:

$$\pi^* = r_{\text{nominal}}(10\text{Y}) - r_{\text{real}}(10\text{Y})$$

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

