# 3d-night — Build Spec

**Model:** Claude Fable 5 (`claude-fable-5`). Use extended thinking. Delegate to sub-agents for the 3D scene, data fixtures, and each agent panel so they can be built in parallel.

**Deploy target:** Vercel, from GitHub. Assume the developer works from GitHub Codespaces or the Claude Code web surface — never assume local files exist. Every commit to `main` deploys.

## The one thing the demo has to do

Every surface answers two questions at once, for every asset and every agent output:

1. **What happened last night** — the discrete event, the overnight agent's finding, the fresh signal.
2. **What that means in context** — where the event sits inside a shorter trend (last week) or a longer one (last quarter, last cycle).

If a panel, chart, or 3D element can't answer both, cut it. A number without a trend is noise; a trend without last night's delta is a history lesson. The product is the join.

Concretely: no bare metrics. Every value is rendered with its own recent trajectory beside it — a sparkline, a ribbon on the terrain, a trailing path behind an agent node. Every event is timestamped and placed on a timeline the user can zoom from "last eight hours" out to "last two years" with one control.

## The five agents

Each produces structured output that both surfaces consume. Build them as pure TypeScript modules under `lib/agents/` returning typed fixtures — no live LLM calls in v1.

1. **Personas (50 of them).** Each reads a different slice — filings, transcripts, options flow, on-chain, macro prints, sector news. None see the others' output. Each produces a directional view, a confidence, and a one-line rationale. The interesting signal is the *disagreement structure*: when do the slices converge, when do they fracture, and does fracture predict anything.
2. **Coder.** Takes one plain-English sentence ("fade gaps in small-cap biotech after FDA calendar events") and emits entry rules, exit rules, sizing, risk limits as a structured strategy object. Show the debug loop: three drafts, each with what broke and what it fixed.
3. **Backtester.** Replays five years in ~12 seconds against the strategy object. Emits an equity curve, drawdown series, per-trade log, and regime-tagged performance.
4. **Breaker.** Its only job is to kill the strategy. Doubles trading costs, replays through the ten worst historical regimes for that asset class, injects slippage shocks. Emits which stress broke it and how badly.
5. **Critic.** Reads a running journal of the user's decisions and names the recurring mistake. Seed with a plausible fake journal in v1. Output is a short prose diagnosis plus the two or three decisions that triggered it.

Every agent output carries: `timestamp`, `asset`, `horizon`, `trend_context` (a series the UI can render). No exceptions.

## Two surfaces, one data layer

### Surface 1 — the dashboard site

A single scrolling page, minimalist. Sections in order: Overnight (what the personas surfaced while you slept), Strategy Lab (coder + backtester side by side), Stress (breaker output), Mirror (critic).

Aesthetic: monochrome base, one accent colour, thin lines, generous whitespace, no card shadows, no gradients. Type-forward. Think a Bloomberg terminal redesigned by someone who's read Edward Tufte and Dieter Rams. Use Inter or Geist for UI, JetBrains Mono for numbers. Numbers are always right-aligned and tabular.

Every metric appears with its trailing series inline. Every event is a dot on a shared timeline strip at the top of the page that stays pinned as you scroll — click a dot, the page scrolls to the relevant section.

Stack: Next.js 15 App Router, Tailwind, shadcn/ui for primitives only (button, tabs, dialog), Recharts for series, Framer Motion for transitions. No state library — React state and URL params are enough.

### Surface 2 — the 3D exploration mode

A separate route, `/explore`. React Three Fiber with Drei. The scene is a terrain where two axes are strategy parameters (entry threshold, holding period — configurable) and height is realized return. This is the backtester's output rendered as landscape.

Elements in the scene:

- **The terrain itself.** Deforms in real time when parameters change. Peaks are profitable regions, valleys are losses. Contour lines, no textures.
- **Persona nodes.** Fifty floating points, positioned by their view. Clusters form and dissolve as disagreement changes. A thin line trails each node showing where it was over the last N sessions — that's the trend context, made spatial.
- **The breaker.** Summonable as a storm system. Sweeps across the terrain and craters peaks that only stood in benign conditions. The user watches the surface deform under stress. Before/after ghost of the pre-stress terrain stays visible as a wireframe.
- **The critic.** A ghost that follows the camera and surfaces a whispered line when the user revisits a region flagged in the journal.
- **Time control.** A scrubber at the bottom moves the whole scene through time — terrain morphs, persona clusters reconfigure, the trailing paths grow or shrink. Same "last night vs trend" join, but in motion.

Camera: orbit controls, gentle inertia, no first-person. Users should be able to grasp the scene in ten seconds, not learn a game.

The failure mode to avoid: a scene that looks impressive for ten seconds and reveals no depth. The test — a PM who spends ninety seconds in `/explore` should walk away understanding a specific strategy's fragility in a way the flat dashboard couldn't have shown them. If flying around doesn't reveal something 2D can't, the 3D mode is a gimmick and should be cut.

## Data

All synthetic, all in `lib/fixtures/`. Coherent across surfaces — the same overnight event shows up on the dashboard timeline and as a fresh crater on the terrain. Generate fixtures deterministically from a seed so the demo is reproducible.

Choose one asset universe and stick with it — I'd suggest 20 US equities spanning a few sectors, plus SPY and VIX. Five years of daily bars, generated with a plausible regime-switching model so the backtester and breaker have real texture to work with.

## Build order

Ship something viewable at the end of each step. Don't move forward until the previous surface deploys clean.

1. Repo, Codespaces config, Vercel wired to `main`, empty Next.js app deployed.
2. Fixture generators for the asset universe and five years of bars. Commit the seeded output as JSON so the app has no runtime dependency on generation.
3. Agent modules as pure functions over the fixtures. Each has a unit test that pins its output.
4. Dashboard site, section by section, in the order listed above. Timeline strip first — it's the spine everything else hangs from.
5. `/explore` route with just the terrain and orbit controls, no agents yet.
6. Persona nodes, then trailing paths, then the breaker storm, then the critic ghost, then the time scrubber. Each as its own commit.
7. Polish pass: typography, spacing, motion timing, empty states.

## Constraints, non-negotiable

- Every session works from a browser alone. No file paths that assume a local machine.
- Push after every meaningful change. The source of truth is `origin/main`, never the workspace.
- No live API calls in v1. Every agent is a deterministic function over fixtures.
- No auth, no backend, no database. Static site with client-side rendering for the 3D route.
- If any single feature is taking longer than a day, stop and ask before continuing.

## What "done" looks like

A URL you can send someone. They land, scroll the dashboard in two minutes and understand the desk. They click through to `/explore`, fly around for ninety seconds, and see a strategy's fragility in a way the dashboard couldn't have shown them. They close the tab thinking about the person who built it.
