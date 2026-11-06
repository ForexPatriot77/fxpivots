# FXPIVOTS — Bain Trading Workstation

A fresh GitHub Pages project using the **actual open-source LuxAlgo Vela chart library**, Twelve Data 15-minute forex candles, and three independent Bain HLC pivot reference sessions.

## Features
- Vela native WebGL2/canvas candlestick chart, 15m / 30m / 1h / 4h display.
- Twelve Data `/time_series` 15-minute candles (700 requested) for 8 selectable forex pairs.
- 12 AM–12 AM, 7 AM–7 AM, and 1 PM–1 PM New York reference sessions, including daylight-saving changes.
- Nine pivot levels per session: R2, M4, R1, M3, PP, M2, S1, M1, S2.
- Previous reference O/H/L/C and Bain range classification (C<O => M1–M3, C>O => M2–M4).
- Vela horizontal price drawings for enabled sessions; default only 12–12 visible for readability.
- Clear errors for incomplete candles, API failures and no-key state. **No simulated market prices.**

## Deploy to GitHub Pages (`fxpivots`)

This is a **Vite project**, not a single HTML file. It must be built before GitHub Pages can serve it. Upload the files to the root of your `fxpivots` repo and enable GitHub Actions Pages deployment under **Settings → Pages → Source: GitHub Actions**. The included `.github/workflows/pages.yml` builds and deploys automatically on push to `main`.

The Vite base path is `/fxpivots/`. If you rename the repository, change `vite.config.js` accordingly.

### Run locally

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

## Twelve Data API key and security

The API key is entered at runtime, held only in page memory, and sent directly to Twelve Data via HTTPS. **This does not protect the key from your own browser's network inspector, browser extensions, or anyone who has access to your session.** Never commit an API key into GitHub. This project is intended for a single user's dashboard. If Twelve Data's browser CORS rules prevent direct calls, or if you want proper key confidentiality, use a server-side proxy or scheduled GitHub Actions data fetch instead. GitHub Pages is publicly accessible even if the source repo is private, depending on plan and settings.

### Rate limits

At 1 pair every 15 minutes, this uses about 96 requests/day while the tab is open. At 1 pair every 5 minutes, about 288/day. It does not fetch all eight pairs at once. It is **not tick streaming**. The current forming 15-minute candle updates on each refresh, not every market tick.

## Pivot mathematics

```text
PP = (H+L+C)/3
R1 = 2*PP-L; S1 = 2*PP-H
R2 = PP+(H-L); S2 = PP-(H-L)
M4=(R1+R2)/2; M3=(PP+R1)/2
M2=(S1+PP)/2; M1=(S1+S2)/2
```

Reference windows normally cover the 24 hours preceding the latest completed cutoff in `America/New_York`. **Monday midnight exception:** for Monday's 12 AM ET cutoff, the reference starts Friday 12 AM ET and ends Monday 12 AM ET, including Sunday evening trading. Closed-weekend intervals are excluded from the missing-data check.

The 7 AM and 1 PM alternate sessions use 24-hour lookbacks. This is a design interpretation of Bain's alternative recalculation times, not a verified statement that he required those exact windows.

Incomplete market-hours data results in a warning and no calculated levels. Holiday closures may be reported as missing data.

## Dependencies and attribution

- `@luxalgo/vela` (Apache 2.0). Keep its visible Vela™ attribution and upstream license notices when redistributing.
- `vite` (build tool).
- No PineTS addon required; pivot math is implemented in JavaScript, not run as Pine Script.

## Testing status

JavaScript syntax and pivot arithmetic can be checked locally. The build and actual browser chart need `npm install` and browser/network access; this package was authored in an environment without npm registry access and **has not been browser-tested**. If the selected Vela release changes drawing API methods, the calculator still works, but horizontal lines may need adapting.
