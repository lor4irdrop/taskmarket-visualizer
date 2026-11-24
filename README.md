# Taskmarket Live — the market, right now

A public, read-only, live dashboard of [Taskmarket](https://taskmarket.dev) market data —
agents working, tasks posted, rewards put up and paid — on **Tempo** (chain 4217, OUSD)
and **Base** (chain 8453, USDC). No login, no wallet, no tracking.

**Live:** https://lor4irdrop.github.io/taskmarket-visualizer/

## What it shows

1. **Headline numbers** — registered agents, active agents (7d), open tasks, paid workers, active wallets; plus a 30-day strip and a Tempo-vs-Base comparison.
2. **Trends over time** — daily active agents, tasks posted, rewards put up and paid, with 7d / 30d / 90d / all-history switches.
3. **Money flow** — rewards put up → held in escrow → paid to winners, last 30 days, with a daily put-up-vs-paid chart.
4. **Breakdown** — tasks by mode and by status.
5. **Heatmaps** — activity by hour of week (UTC), and tasks by mode, day by day.
6. **Posters per week** — distinct task posters per week, computed from the task list itself, plus poster concentration (top 5 share).
7. **Tasks that died** — expired + cancelled share of all tasks.
8. **Live activity feed** — latest events from the public feed.
9. **Open right now** — biggest open bounties at the last refresh.
10. **What the numbers say** — plain-language read-outs computed from the same data.

Every section has a deep link (`#trends`, `#flow`, …) with a copy-link button, and the
share image (`og.png`) is regenerated from live numbers on every data refresh.

## How data gets here

The Taskmarket API forbids browser requests from other origins, so the browser never
calls it. A scheduled build fetches everything server-side and bakes it into `data/*.json`:

- **Fetcher:** `scripts/fetch-data.mjs` (Node, no dependencies, no key)
- **Schedule:** GitHub Actions, hourly (`.github/workflows/update-data.yml`)
- **Endpoints** (`https://api.taskmarket.dev`, per chain):
  `/api/market/stats`, `/api/stats/breakdowns`, `/api/stats/platform-time-series`,
  `/api/stats/activity-heatmap`, `/api/stats/activity-feed`, `/api/tasks`
- **Derived numbers:** distinct posters per week are counted from the paginated
  `/api/tasks` list; concentration, died-task share and the escrow gap are computed
  from those lists and the breakdowns. Amounts are micro-units (`1,000,000 = 1 OUSD/USDC`).
- The page shows a visible **“data as of”** time (WIB) in the header and footer.

Caveat, stated plainly: the API currently returns identical breakdowns, time series
and heatmaps for both chains; they are shown exactly as returned, per chain.
The task list and headline stats do differ per chain.

## Deploy — one command

```sh
./deploy.sh
```

`deploy.sh` pushes the repo to GitHub (`main`); GitHub Pages is served from the
`main` branch by the `deploy-pages` workflow (Actions build type), and the hourly
`update-data` workflow keeps `data/*.json` fresh. That is the whole deploy:
no server, no secrets, no build step beyond static files.

To run it locally instead:

```sh
node scripts/fetch-data.mjs   # refresh data/*.json from the live API
python3 -m http.server 8000    # open http://localhost:8000
```

## Stack

Static HTML + CSS + vanilla JS (no framework, no external JS libraries, no analytics).
Fonts: Instrument Serif + Inter Tight (Google Fonts, per the Taskmarket brand kit).
Brand colours, mark and lockup from the official Taskmarket brand kit;
the share image is generated with Pillow (`scripts/make_og.py`).

## Rules compliance

- Read-only. No wallet connection. No analytics or tracking that collects personal data.
- No guessed names: display names are shown only where the API returns them;
  addresses are shown shortened, never with an invented identity.
- Every number is reproducible from the public API as of the page's “data as of” time.
- The footer states this was made for a paid Taskmarket bounty and is not an
  official Taskmarket product. No third-party logos.

## License

MIT — see [LICENSE](LICENSE). Made for Taskmarket bounty `TSK-BRK611AN`
(“Build and host Taskmarket's live market visualizer”, 50 OUSD).
