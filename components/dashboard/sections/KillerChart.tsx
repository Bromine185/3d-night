"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { STRATEGY, runBacktest, runBreaker } from "@/lib/agents";
import { fmtDateYear } from "@/lib/format";
import { INK, NightTooltip, TICK, thin, yearTicks } from "./chartTheme";

interface Row {
  date: string;
  base?: number;
  stressed?: number;
}

/** Direct label pinned to a line's final point. */
function lastLabel(text: string, color: string, total: number) {
  return function LastLabel(props: { x?: number | string; y?: number | string; index?: number }) {
    const { x, y, index } = props;
    if (index !== total - 1 || x === undefined || y === undefined) return <g />;
    return (
      <text
        x={Number(x) - 4}
        y={Number(y) - 8}
        textAnchor="end"
        fill={color}
        fontSize={10}
        fontFamily="var(--font-mono)"
      >
        {text}
      </text>
    );
  };
}

/** Base equity in gray, the killer stress in accent — same axis, same trades. */
export function KillerChart() {
  const base = runBacktest(STRATEGY).equity;
  const stressed = runBreaker(STRATEGY).trend_context;

  const bySDate = new Map(stressed.map((p) => [p.date, p.value]));
  const merged: Row[] = base.map((p) => ({
    date: p.date,
    base: p.value,
    stressed: bySDate.get(p.date),
  }));
  const data = thin(merged);
  const ticks = yearTicks(data.map((p) => p.date));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 14, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={INK.grid} vertical={false} />
        <XAxis
          dataKey="date"
          ticks={ticks}
          tickFormatter={(d: string) => `’${d.slice(2, 4)}`}
          tick={TICK}
          axisLine={{ stroke: INK.grid }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          width={38}
          domain={["auto", "auto"]}
          tickFormatter={(v: number) => v.toFixed(2)}
          tick={TICK}
          axisLine={false}
          tickLine={false}
          tickCount={4}
        />
        <ReferenceLine y={1} stroke={INK.faint} strokeDasharray="2 4" strokeWidth={1} />
        <Tooltip
          cursor={{ stroke: INK.faint, strokeWidth: 1 }}
          content={
            <NightTooltip
              format={(v, name) => `${name === "stressed" ? "shocked" : "base"} ${v.toFixed(3)}×`}
              formatLabel={fmtDateYear}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="base"
          stroke={INK.gray}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
          label={lastLabel("base", INK.gray, data.length)}
        />
        <Line
          type="monotone"
          dataKey="stressed"
          stroke={INK.accent}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
          label={lastLabel("slippage-shocked", INK.accent, data.length)}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
