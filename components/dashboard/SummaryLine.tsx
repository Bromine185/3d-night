import type { TrendPoint } from "@/lib/agents/types";
import { Spark } from "./Spark";

/**
 * The collapsed face of a section: one line of real numbers, its trend
 * beside it. Even folded shut, a section answers "what happened last
 * night and what that means in context".
 */
export function SummaryLine({
  children,
  trend,
  showZero,
}: {
  children: React.ReactNode;
  trend?: Array<TrendPoint | number>;
  showZero?: boolean;
}) {
  return (
    <>
      <span className="truncate font-mono text-[12px] tabular-nums text-muted-foreground">
        {children}
      </span>
      {trend && (
        <Spark
          data={trend}
          width={72}
          height={18}
          showZero={showZero}
          className="hidden shrink-0 self-center sm:block"
        />
      )}
    </>
  );
}
