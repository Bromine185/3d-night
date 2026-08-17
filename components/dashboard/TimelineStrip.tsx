"use client";

/**
 * The spine. A pinned strip across the top of the dashboard: every market
 * event and every overnight agent finding as a dot on one time axis, zoomable
 * from the last eight hours out to two years. Click a dot, the page scrolls
 * to the section that owns it. The regime ribbon under the axis is the longer
 * trend every dot sits inside.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useRef, useState } from "react";
import { fmtClock, fmtDateYear } from "@/lib/format";
import {
  NOW_MS,
  ZOOMS,
  type TimelineDot,
  type ZoomId,
  buildTimeline,
  regimeSpans,
} from "@/lib/timeline";

const KIND_LABEL: Record<TimelineDot["kind"], string> = {
  market: "market",
  personas: "personas",
  coder: "coder",
  backtester: "backtester",
  breaker: "breaker",
  critic: "critic",
};

/** Regime darkness — the ribbon reads as weather, light to heavy. */
const REGIME_SHADE: Record<string, number> = {
  expansion: 0.07,
  recovery: 0.11,
  late_cycle: 0.18,
  chop: 0.26,
  correction: 0.42,
  crisis: 0.6,
};

function fmtTick(t: number, zoomMs: number): string {
  const d = new Date(t);
  if (zoomMs <= 9 * 3600_000) {
    // hourCycle (not hour12:false) so midnight is "00" on every ICU — the
    // server and the browser must agree or hydration trips.
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "America/New_York",
    });
  }
  if (zoomMs <= 40 * 86_400_000) {
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "America/New_York",
    });
  }
  return d.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "America/New_York",
  });
}

export function TimelineStrip() {
  const [zoom, setZoom] = useState<ZoomId>("8h");
  const [hover, setHover] = useState<TimelineDot | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const dots = useMemo(() => buildTimeline(), []);
  const spans = useMemo(() => regimeSpans(), []);
  const zoomMs = ZOOMS.find((z) => z.id === zoom)!.ms;
  const t0 = NOW_MS - zoomMs;

  const visible = useMemo(() => {
    const inView = dots.filter((d) => d.t >= t0 && d.t <= NOW_MS);
    // At wide zooms thin the market dots so the strip stays a texture, not a smear.
    if (inView.length > 260) {
      const market = inView.filter((d) => d.kind === "market");
      const rest = inView.filter((d) => d.kind !== "market");
      const keep = Math.ceil(market.length / Math.ceil(market.length / 220));
      const step = market.length / keep;
      const thinned: TimelineDot[] = [];
      for (let i = 0; i < market.length; i += step) thinned.push(market[Math.floor(i)]);
      return [...thinned, ...rest].sort((a, b) => a.t - b.t);
    }
    return inView;
  }, [dots, t0]);

  const ticks = useMemo(() => {
    const n = 6;
    return Array.from({ length: n + 1 }, (_, i) => t0 + (i / n) * zoomMs);
  }, [t0, zoomMs]);

  const xPct = (t: number) => ((t - t0) / zoomMs) * 100;

  // Deterministic sub-lane so co-timed dots stack instead of overprinting.
  const laneOf = (d: TimelineDot, i: number) =>
    d.kind === "market" ? (i * 7) % 3 : d.kind === "personas" ? (i * 5) % 3 : 1;

  const scrollTo = (section: string) => {
    document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div
      ref={ref}
      className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex items-center justify-between pt-3">
          <span className="label-caps">timeline</span>
          <div className="flex gap-1">
            {ZOOMS.map((z) => (
              <button
                key={z.id}
                onClick={() => setZoom(z.id)}
                className={`px-2 py-0.5 font-mono text-[11px] tracking-wider transition-colors ${
                  zoom === z.id
                    ? "text-[var(--night-accent)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={zoom === z.id}
              >
                {z.label}
              </button>
            ))}
          </div>
        </div>

        <div className="relative h-[78px] select-none">
          {/* regime ribbon — the longer trend under everything */}
          <div className="absolute inset-x-0 top-[40px] h-[3px] overflow-hidden">
            {spans
              .filter((s) => s.endMs >= t0 && s.startMs <= NOW_MS)
              .map((s, i) => {
                const a = Math.max(0, xPct(Math.max(s.startMs, t0)));
                const b = Math.min(100, xPct(Math.min(s.endMs, NOW_MS)));
                return (
                  <div
                    key={i}
                    className="absolute h-full"
                    style={{
                      left: `${a}%`,
                      width: `${Math.max(b - a, 0)}%`,
                      background: `rgba(230,230,234,${REGIME_SHADE[s.regime] ?? 0.1})`,
                    }}
                  />
                );
              })}
          </div>

          {/* axis */}
          <div className="absolute inset-x-0 top-[39px] h-px bg-border" />
          {ticks.map((t, i) => (
            <div
              key={i}
              className="absolute top-[46px] whitespace-nowrap font-mono text-[10px] text-[var(--night-faint)]"
              style={{
                left: `${xPct(t)}%`,
                transform:
                  i === 0 ? "none" : i === ticks.length - 1 ? "translateX(-100%)" : "translateX(-50%)",
              }}
            >
              {fmtTick(t, zoomMs)}
            </div>
          ))}

          {/* dots */}
          <AnimatePresence mode="popLayout">
            {visible.map((d, i) => {
              const agent = d.kind !== "market";
              return (
                <motion.button
                  key={`${d.t}-${d.kind}-${d.headline}`}
                  initial={{ opacity: 0, scale: 0.4, x: "-50%", left: `${xPct(d.t)}%` }}
                  animate={{ opacity: 1, scale: 1, x: "-50%", left: `${xPct(d.t)}%` }}
                  exit={{ opacity: 0, scale: 0.4, x: "-50%" }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  onMouseEnter={() => setHover(d)}
                  onMouseLeave={() => setHover((h) => (h === d ? null : h))}
                  onFocus={() => setHover(d)}
                  onBlur={() => setHover(null)}
                  onClick={() => scrollTo(d.section)}
                  aria-label={`${KIND_LABEL[d.kind]}: ${d.headline}`}
                  className="absolute cursor-pointer p-1"
                  style={{ top: `${16 + laneOf(d, i) * 5 - 4}px` }}
                >
                  <span
                    className="block rounded-full"
                    style={{
                      width: agent ? 5 : 3.5,
                      height: agent ? 5 : 3.5,
                      background: agent ? "var(--night-accent)" : "var(--night-faint)",
                      opacity: agent ? 0.95 : 0.7,
                    }}
                  />
                </motion.button>
              );
            })}
          </AnimatePresence>

          {/* now marker */}
          <div className="absolute right-0 top-[13px] h-[27px] w-px bg-[var(--night-accent)] opacity-70" />

          {/* hover readout — fixed slot, no layout shift */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-4 items-center justify-between font-mono text-[11px]">
            {hover ? (
              <>
                <span className="truncate pr-4 text-foreground">
                  <span className="text-[var(--night-accent)]">{KIND_LABEL[hover.kind]}</span>
                  {"  "}
                  {hover.headline}
                </span>
                <span className="shrink-0 text-muted-foreground">
                  {fmtDateYear(new Date(hover.t).toISOString().slice(0, 10))} ·{" "}
                  {fmtClock(new Date(hover.t - 4 * 3600_000).toISOString())} ET
                </span>
              </>
            ) : (
              <span className="text-[var(--night-faint)]">
                {visible.length} events in view — click a dot to jump
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
