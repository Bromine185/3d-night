# 3d-night

An overnight research desk. Every surface answers two questions at once, for
every asset and every agent output:

1. **What happened last night** — the discrete event, the overnight agent's
   finding, the fresh signal.
2. **What that means in context** — where the event sits inside a shorter trend
   (last week) or a longer one (last quarter, last cycle).

See [`CLAUDE.md`](./CLAUDE.md) for the full build spec.

## Stack

- **Next.js 15** (App Router) + **TypeScript**
- **Tailwind CSS v4**
- **shadcn/ui** for primitives (button, tabs, dialog)
- **pnpm** for package management
- Deployed on **Vercel** — every commit to `main` deploys.

Two surfaces share one synthetic data layer (all fixtures in `lib/fixtures/`):

- **`/`** — the scrolling dashboard.
- **`/explore`** — the React Three Fiber terrain.

## Develop

```bash
pnpm install
pnpm dev      # http://localhost:3000
```

Other scripts:

```bash
pnpm build    # production build
pnpm lint     # eslint
pnpm fixtures # regenerate lib/fixtures/data/*.json from the seed
```

## Data layer

All prices are **synthetic**. The tickers are real; none of the history is.

`lib/fixtures/data/*.json` is generated once and committed, so the app has no
runtime dependency on generation. `pnpm fixtures` is byte-deterministic from
`FIXTURE_SEED` — run it only when the model changes, and commit the diff.

| file | contents |
| --- | --- |
| `universe.json` | 22 assets — 20 US equities across 7 sectors, plus SPY and VIX |
| `bars.json` | columnar OHLCV, 1,255 sessions × 22 assets (27,610 bars) |
| `market.json` | regime per day, market-factor returns, VIX, regime segments |
| `events.json` | 555 dated events — earnings, FDA catalysts, guidance, macro prints |

Prices come from a six-state regime-switching model (expansion, late cycle,
chop, correction, crisis, recovery) driving a market factor, seven sector
factors with per-regime drift, and per-asset residuals. Volatility clusters
across regimes; events land as overnight gaps. The generator resamples the
regime path until it contains a crisis, multiple corrections and a recovery, so
the backtester and breaker always have hostile stretches to replay.

Read it through `lib/fixtures/index.ts` — `getBars`, `getCloses`, `trailing`,
`regimeOn`, `eventsOn`. Nothing downstream should import the generator.

## Build order

Progress follows the numbered build order in `CLAUDE.md`. Ship something
viewable at the end of each step; `origin/main` is the source of truth.

1. **✅ Scaffold** — Next.js + Tailwind + shadcn/ui, deployed to Vercel.
2. **✅ Fixtures** — asset universe and five years of bars, committed as JSON.
3. Agent modules as pure functions over the fixtures.
4. Dashboard site, section by section.
5. `/explore` route: terrain + orbit controls.
6. Persona nodes, trailing paths, breaker storm, critic ghost, time scrubber.
7. Polish pass.
