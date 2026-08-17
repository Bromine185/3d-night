import type { TrendPoint } from "@/lib/agents/types";

/**
 * The inline trailing series that rides beside every metric. Pure SVG, one
 * thin line, an accent dot on the newest point — the "last night" of the
 * last-night-vs-trend join. Optional zero baseline for signed series.
 */
export function Spark({
  data,
  width = 96,
  height = 24,
  showZero = false,
  accentLast = true,
  className,
}: {
  data: Array<TrendPoint | number>;
  width?: number;
  height?: number;
  showZero?: boolean;
  accentLast?: boolean;
  className?: string;
}) {
  const values = data.map((d) => (typeof d === "number" ? d : d.value));
  if (values.length < 2) return null;

  const pad = 2.5;
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (showZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (max - min < 1e-12) {
    min -= 1;
    max += 1;
  }
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - 2 * pad);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (height - 2 * pad);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const lastV = values[values.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
      style={{ overflow: "visible", flex: "none" }}
    >
      {showZero && min < 0 && max > 0 && (
        <line
          x1={pad}
          x2={width - pad}
          y1={y(0)}
          y2={y(0)}
          stroke="var(--night-faint)"
          strokeWidth={1}
          strokeDasharray="1.5 3"
        />
      )}
      <path d={d} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.25} />
      {accentLast && (
        <circle cx={x(values.length - 1)} cy={y(lastV)} r={2} fill="var(--night-accent)" />
      )}
    </svg>
  );
}
