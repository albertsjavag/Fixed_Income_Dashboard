# CLAUDE.md — Fixed Income Dashboard

## Project overview

Next.js 14 (Pages Router) dashboard tracking sovereign fixed income markets for Norway, Germany, and the United States. No database — all data is fetched from external APIs at runtime and cached in memory.

## Architecture rules

- **Never expose `FRED_API_KEY` to the browser.** All FRED fetches happen in `src/pages/api/` routes only.
- **API routes are the data boundary.** Frontend components call `/api/*` via SWR; they never call FRED or Norges Bank directly.
- **1-hour in-memory cache** is implemented in `src/lib/cache.ts`. Every API route must call `getCache` before fetching and `setCache` after. Don't bypass this.
- **No database, no file system writes.** This is a stateless read-only app.

## Data sources

| Source | Library file | Key detail |
|--------|-------------|------------|
| FRED API | `src/lib/fred.ts` | Requires `FRED_API_KEY` env var. Missing values (`.`) are filtered out. |
| Norges Bank | `src/lib/norgesbank.ts` | SDMX-JSON format. Series: `STATBPI/B.NOWA.{maturity}.NOK`. No auth required. |

## Known data limitations (already handled in UI)

- German yield curve: only 10Y available (FRED `IRLTLT01DEM156N`, monthly). No free API for shorter maturities.
- German and Norwegian breakeven inflation: no free daily series available. Noted in UI via `<p className="note">`.

## Stats utilities

All math lives in `src/lib/stats.ts`:
- `zscore(value, values[])` — single z-score
- `rollingCorrelation(a[], b[], window)` — Pearson, returns `null` for insufficient window
- `alignByDate` / `alignThree` — join series by matching date strings (YYYY-MM-DD)

## Component conventions

- Every section is a standalone component in `src/components/`
- Data fetching: `useSWR` with `refreshInterval: 3600_000`
- Loading state: `<div className="skeleton" style={{ height: N }} />`
- Error state: `<p style={{ color: "var(--red)" }}>Failed to load ...</p>`
- Data limitations noted inline with `<p className="note">⚠ ...</p>`

## Styling

- CSS variables in `src/styles/globals.css` — use these, don't hardcode hex values
- Dark theme: `--bg: #0f1117`, `--surface: #161b27`, `--surface-2: #1e2535`
- Accent: `--blue: #3b82f6`, `--gold: #f59e0b`
- Status colors: `--green`, `--red`, `--yellow`
- No Tailwind, no CSS modules — plain CSS via className and inline styles

## Commands

```bash
npm run dev    # local dev server on :3000
npm run build  # production build (run this to check for type errors)
npm start      # serve the production build
```

## Deployment

Render.com, Node runtime.
- Build: `npm install && npm run build`
- Start: `npm start`
- Env var: `FRED_API_KEY`
