import Link from "next/link";
import { AccordionProvider } from "@/components/dashboard/Accordion";
import { TimelineStrip } from "@/components/dashboard/TimelineStrip";
import { OvernightSection } from "@/components/dashboard/sections/Overnight";
import { StrategyLabSection } from "@/components/dashboard/sections/StrategyLab";
import { StressSection } from "@/components/dashboard/sections/Stress";
import { MirrorSection } from "@/components/dashboard/sections/Mirror";
import { LATEST_DATE } from "@/lib/fixtures";
import { RUN_DATE } from "@/lib/agents/clock";
import { fmtDate } from "@/lib/format";

export default function Home() {
  return (
    <main className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-baseline justify-between px-6 pb-5 pt-8">
        <div className="flex items-baseline gap-4">
          <h1 className="text-lg font-medium tracking-tight">3d-night</h1>
          <span className="font-mono text-[11px] text-muted-foreground">
            overnight desk · {fmtDate(LATEST_DATE)} close → {fmtDate(RUN_DATE)} open
          </span>
        </div>
        <Link
          href="/explore"
          className="font-mono text-[11px] tracking-wider text-muted-foreground transition-colors hover:text-[var(--night-accent)]"
        >
          EXPLORE →
        </Link>
      </header>

      <AccordionProvider>
        <TimelineStrip />

        <div className="mx-auto max-w-6xl px-6 pb-32">
          <OvernightSection />
          <StrategyLabSection />
          <StressSection />
          <MirrorSection />
        </div>
      </AccordionProvider>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 font-mono text-[11px] text-[var(--night-faint)]">
          <span>synthetic prices on real tickers · seeded, deterministic, reproducible</span>
          <span>five agents, one night</span>
        </div>
      </footer>
    </main>
  );
}
