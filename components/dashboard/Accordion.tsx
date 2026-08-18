"use client";

/**
 * One section open at a time. Scrolling is the primary control: the section
 * whose header last crossed the activation line (40% down the viewport) is
 * the open one. Clicking a header opens it (or closes it, leaving nothing
 * open until the next real scroll). Timeline dots jump: expand instantly,
 * then smooth-scroll a stable layout.
 *
 * The hazard this file exists to manage: collapsing a tall section above
 * your read-point shifts the whole document. The rule, by direction —
 *
 *   scrolling down   old collapses above: INSTANT, compensated
 *                    new unfolds below:   animated
 *   scrolling up     new expands above:   INSTANT, compensated
 *                    old folds below:     animated
 *   header click     others snap shut, compensated; yours unfolds in place
 *   timeline jump    everything instant; the smooth scroll is the motion
 *
 * "Compensated" = the eye-line header's viewport position is recorded
 * before the state change and restored with an instant scrollBy in the
 * same layout pass, so the page never moves under the reader. Instant
 * transitions are synchronous CSS (grid-template-rows with transition
 * disabled), which is what makes same-pass compensation possible.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

export type SectionId = "overnight" | "lab" | "stress" | "mirror";

export const SECTION_ORDER: SectionId[] = ["overnight", "lab", "stress", "mirror"];

type TransitionKind = "scroll-down" | "scroll-up" | "manual-open" | "manual-close" | "jump";

interface AccordionState {
  active: SectionId | null;
  kind: TransitionKind;
  toggle: (id: SectionId) => void;
  jumpTo: (id: SectionId) => void;
}

const AccordionContext = createContext<AccordionState | null>(null);

export function useAccordion(): AccordionState | null {
  return useContext(AccordionContext);
}

/** Per-element animation rule. A section asks with its own open state. */
export function isInstant(kind: TransitionKind, open: boolean): boolean {
  if (kind === "jump") return true;
  if (open) return kind === "scroll-up";
  return kind === "scroll-down" || kind === "manual-open";
}

/** Viewport fraction where a header takes over as the active section. */
const ACTIVATION = 0.4;
/** Scroll distance that clears a manual close and re-arms auto-open. */
const MANUAL_CLEAR_PX = 150;

/** Only explicit intent (click, timeline jump) is reflected in the URL. */
function setUrl(id: SectionId) {
  window.history.replaceState(null, "", `?s=${id}`);
}

export function AccordionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ active: SectionId | null; kind: TransitionKind }>({
    active: "overnight",
    kind: "jump",
  });
  const activeRef = useRef(state.active);
  activeRef.current = state.active;

  // Pending scroll compensation: keep this element's viewport-top fixed
  // across the commit that opens/closes sections.
  const anchor = useRef<{ id: string; top: number } | null>(null);
  // Suppress scroll-driven activation while a jump's smooth scroll flies.
  const navLock = useRef(false);
  const navTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // After a manual close, don't auto-reopen until the user really scrolls.
  const manualClose = useRef<number | null>(null);
  // Cooldown: a physical scroll can't legitimately flip sections twice in
  // 150ms — anything faster is a feedback loop, and gets dropped.
  const lastActivate = useRef(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Restore the anchor's viewport position after an instant transition.
  // Parent layout effects run after children commit their height changes,
  // and instant collapses are synchronous CSS — so this lands pre-paint.
  useLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    const el = document.getElementById(a.id);
    if (!el) return;
    const delta = el.getBoundingClientRect().top - a.top;
    if (Math.abs(delta) > 1) window.scrollBy({ top: delta, behavior: "instant" });
  });

  /** Scroll-driven transition — see the direction rule up top. */
  const activate = useCallback((id: SectionId) => {
    const prev = activeRef.current;
    if (prev === id) return;
    const now = performance.now();
    if (now - lastActivate.current < 150) return;
    lastActivate.current = now;
    // The collapse above may clamp the scroll position; keep the line rule
    // quiet while those synthetic scroll events land, or it can steal the
    // activation straight back.
    navLock.current = true;
    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => {
      navLock.current = false;
    }, 500);
    const goingDown = prev === null || SECTION_ORDER.indexOf(id) > SECTION_ORDER.indexOf(prev);
    // Anchor the eye-line: the incoming header when descending; the first
    // header still below the activation line when ascending.
    let anchorId: string = id;
    if (!goingDown) {
      const line = window.innerHeight * ACTIVATION;
      anchorId =
        SECTION_ORDER.find((s) => {
          const el = document.getElementById(s);
          return el && el.getBoundingClientRect().top > line;
        }) ?? id;
    }
    const el = document.getElementById(anchorId);
    if (el) anchor.current = { id: anchorId, top: el.getBoundingClientRect().top };
    // Scroll-driven changes never touch the URL — only explicit intent does.
    setState({ active: id, kind: goingDown ? "scroll-down" : "scroll-up" });
  }, []);

  // The activation line. rAF-throttled; four getBoundingClientRect calls.
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (navLock.current) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (manualClose.current !== null) {
          if (Math.abs(window.scrollY - manualClose.current) < MANUAL_CLEAR_PX) return;
          manualClose.current = null;
        }
        const line = window.innerHeight * ACTIVATION;
        // No header above the line means the reader is parked at the very
        // top of whatever is open — keep it. Defaulting to the first
        // section here would steal activations whenever a collapse above
        // the viewport clamps the scroll position to 0.
        let candidate: SectionId | null = null;
        for (const id of SECTION_ORDER) {
          const el = document.getElementById(id);
          if (el && el.getBoundingClientRect().top <= line) candidate = id;
        }
        if (candidate !== null && candidate !== activeRef.current) activate(candidate);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [activate]);

  // The activation line can't reach headers pinned near the bottom: with
  // everything below collapsed, the page is too short to lift them. So a
  // wheel-down at the document's end means "keep reading" — advance to the
  // next section. Its expansion regrows the page and normal scrolling
  // resumes. (At max scroll no scroll event fires, hence a wheel listener.)
  useEffect(() => {
    let lastAdvance = 0;
    const onWheel = (e: WheelEvent) => {
      if (navLock.current || e.deltaY <= 4) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (window.scrollY < max - 4) return;
      const now = performance.now();
      if (now - lastAdvance < 700) return;
      const idx = activeRef.current ? SECTION_ORDER.indexOf(activeRef.current) : -1;
      const next = SECTION_ORDER[idx + 1];
      if (!next) return;
      lastAdvance = now;
      manualClose.current = null;
      activate(next);
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => window.removeEventListener("wheel", onWheel);
  }, [activate]);

  // Deep link: ?s=lab opens and lands there on load.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("s") as SectionId | null;
    if (id && SECTION_ORDER.includes(id) && id !== activeRef.current) {
      setState({ active: id, kind: "jump" });
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "instant", block: "start" });
      });
    }
  }, []);

  const lockUntilScrollEnd = useCallback(() => {
    navLock.current = true;
    if (navTimer.current) clearTimeout(navTimer.current);
    const release = () => {
      navLock.current = false;
      window.removeEventListener("scrollend", release);
      if (navTimer.current) clearTimeout(navTimer.current);
    };
    window.addEventListener("scrollend", release);
    // Fallback for browsers without scrollend.
    navTimer.current = setTimeout(release, 1400);
  }, []);

  /** Header click: open under the cursor, or close an open section. */
  const toggle = useCallback((id: SectionId) => {
    if (activeRef.current === id) {
      manualClose.current = window.scrollY;
      setState({ active: null, kind: "manual-close" });
      return;
    }
    const el = document.getElementById(id);
    if (el) anchor.current = { id, top: el.getBoundingClientRect().top };
    // A big collapse above can clamp the scroll position; hold the line
    // rule off until those scroll events have landed.
    navLock.current = true;
    if (navTimer.current) clearTimeout(navTimer.current);
    navTimer.current = setTimeout(() => {
      navLock.current = false;
    }, 500);
    setState({ active: id, kind: "manual-open" });
    setUrl(id);
  }, []);

  /** Timeline dot: settle layout instantly, then one smooth scroll. */
  const jumpTo = useCallback(
    (id: SectionId) => {
      lockUntilScrollEnd();
      setState({ active: id, kind: "jump" });
      setUrl(id);
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({
          behavior: reducedMotion.current ? "instant" : "smooth",
          block: "start",
        });
        // Land keyboard/SR focus on the section's header without disturbing
        // the smooth scroll.
        document
          .querySelector<HTMLButtonElement>(`[aria-controls="${id}-body"]`)
          ?.focus({ preventScroll: true });
      });
    },
    [lockUntilScrollEnd],
  );

  return (
    <AccordionContext.Provider value={{ active: state.active, kind: state.kind, toggle, jumpTo }}>
      {children}
    </AccordionContext.Provider>
  );
}
