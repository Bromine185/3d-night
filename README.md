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
```

## Build order

Progress follows the numbered build order in `CLAUDE.md`. Ship something
viewable at the end of each step; `origin/main` is the source of truth.

1. **✅ Scaffold** — Next.js + Tailwind + shadcn/ui, deployed to Vercel.
2. Fixture generators for the asset universe and five years of bars.
3. Agent modules as pure functions over the fixtures.
4. Dashboard site, section by section.
5. `/explore` route: terrain + orbit controls.
6. Persona nodes, trailing paths, breaker storm, critic ghost, time scrubber.
7. Polish pass.
