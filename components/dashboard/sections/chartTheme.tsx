/**
 * Shared chart chrome: recessive axes, dark tooltip, the two series inks.
 * Single-series charts carry identity in their title — no legends.
 */
export const INK = {
  accent: "var(--night-accent)",
  gray: "#9a9aa3",
  faint: "#55555e",
  grid: "#1a1a20",
};

export const TICK = {
  fill: "#55555e",
  fontSize: 10,
  fontFamily: "var(--font-mono)",
} as const;

interface NightTooltipProps {
  /** Injected by Recharts at render time. */
  active?: boolean;
  payload?: Array<{ dataKey?: string | number; value?: number | string }>;
  label?: string | number;
  format: (value: number, name: string) => string;
  formatLabel?: (label: string) => string;
}

export function NightTooltip({ active, payload, label, format, formatLabel }: NightTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-border bg-popover px-2.5 py-1.5 font-mono text-[11px] leading-relaxed">
      <div className="text-muted-foreground">
        {formatLabel ? formatLabel(String(label)) : String(label)}
      </div>
      {payload.map(
        (p) =>
          typeof p.value === "number" && (
            <div key={p.dataKey as string} className="text-foreground">
              {format(p.value, String(p.dataKey))}
            </div>
          ),
      )}
    </div>
  );
}

/** Keep every Nth point plus the last — Recharts stays fluid, lines stay true. */
export function thin<T>(arr: T[], n = 2): T[] {
  return arr.filter((_, i) => i % n === 0 || i === arr.length - 1);
}

/** First session of each year in a date-keyed series — sparse x ticks. */
export function yearTicks(dates: string[]): string[] {
  const seen = new Set<string>();
  const ticks: string[] = [];
  for (const d of dates) {
    const y = d.slice(0, 4);
    if (!seen.has(y)) {
      seen.add(y);
      ticks.push(d);
    }
  }
  return ticks.slice(1); // drop the partial first year's edge tick
}
