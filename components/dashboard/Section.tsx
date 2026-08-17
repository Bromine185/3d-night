"use client";

/**
 * Shared section shell, now collapsible. Collapsed, a section is one row:
 * the numbered label, a summary line with real numbers and its trend beside
 * it — the whole desk legible in four lines. Expanded, the full body.
 *
 * Height animates via grid-template-rows (0fr → 1fr): pure CSS, so the
 * accordion's instant transitions are synchronous and its scroll
 * compensation can land in the same layout pass. The body stays mounted
 * either way — charts keep their state, and the timeline's anchors exist
 * before a section is ever opened. `inert` keeps collapsed content out of
 * the tab order.
 */
import { isInstant, useAccordion, type SectionId } from "./Accordion";

export function Section({
  id,
  index,
  title,
  subtitle,
  summary,
  children,
}: {
  id: SectionId;
  index: string;
  title: string;
  subtitle: string;
  /** The collapsed row: one line of numbers with a Spark beside them. */
  summary?: React.ReactNode;
  children: React.ReactNode;
}) {
  const acc = useAccordion();
  const open = acc ? acc.active === id : true;
  const instant = acc ? isInstant(acc.kind, open) : false;

  return (
    <section id={id} className="scroll-mt-28 border-t border-border first:border-t-0">
      <h2 className="m-0">
        <button
          type="button"
          onClick={() => acc?.toggle(id)}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          className="group flex w-full items-baseline gap-x-6 py-6 text-left"
        >
          <span className="label-caps shrink-0 transition-colors group-hover:text-foreground">
            {index} · {title}
          </span>
          <span
            className={`flex min-w-0 flex-1 items-baseline justify-end gap-x-6 transition-opacity duration-300 md:justify-between ${
              open ? "opacity-0" : "opacity-100 delay-150"
            }`}
            aria-hidden={open}
          >
            {summary}
          </span>
          <span
            className={`shrink-0 font-mono text-[11px] text-[var(--night-faint)] transition-transform duration-300 group-hover:text-muted-foreground ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden
          >
            ▸
          </span>
        </button>
      </h2>

      <div
        id={`${id}-body`}
        inert={!open}
        className={`grid ${
          instant ? "" : "transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        }`}
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-16 pt-2">
            <p className="mb-10 max-w-xl text-sm text-muted-foreground">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}
