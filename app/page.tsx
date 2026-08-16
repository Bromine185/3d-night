import { Button } from "@/components/ui/button";
import {
  ASSETS,
  DATES,
  EVENTS,
  LATEST_DATE,
  META,
  SEGMENTS,
  regimeOn,
} from "@/lib/fixtures";

const facts: Array<[string, string]> = [
  ["window", `${META.startDate} → ${META.endDate}`],
  ["sessions", DATES.length.toLocaleString()],
  ["assets", String(ASSETS.length)],
  ["bars", (DATES.length * ASSETS.length).toLocaleString()],
  ["events", EVENTS.length.toLocaleString()],
  ["regime segments", String(SEGMENTS.length)],
  ["last session", `${LATEST_DATE} · ${regimeOn(LATEST_DATE)?.replace("_", " ")}`],
  ["seed", String(META.seed)],
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center gap-10 px-6 py-24">
      <header className="flex flex-col gap-4">
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          overnight research desk
        </span>
        <h1 className="text-4xl font-medium tracking-tight sm:text-5xl">
          3d-night
        </h1>
        <p className="max-w-xl text-balance text-muted-foreground">
          Every surface answers two questions at once: what happened last night,
          and what that means in context. The dashboard and the{" "}
          <span className="font-mono">/explore</span> terrain are on their way.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          data layer
        </h2>
        <dl className="grid grid-cols-[minmax(0,10rem)_1fr] gap-x-8 gap-y-1 border-t border-border pt-3 font-mono text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="font-mono text-xs text-muted-foreground">
          Synthetic prices on real tickers. Generated once from the seed and
          committed — nothing is computed at request time.
        </p>
      </section>

      <div className="flex items-center gap-3">
        <Button disabled>Dashboard</Button>
        <Button variant="outline" disabled>
          Explore
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          fixtures · step 2
        </span>
      </div>
    </main>
  );
}
