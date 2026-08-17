"use client";

/**
 * The exploration mode. One scene: the strategy's parameter space as terrain,
 * the fifty personas as weather above it, the breaker as a storm you summon,
 * the critic as a ghost that whispers when you linger where the journal says
 * you've been before, and a scrubber that moves all of it through time.
 *
 * Every feature mounts as one self-contained element; each can be removed
 * without touching the others.
 */
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Surface } from "@/lib/agents/types";
import { LATEST_INDEX } from "@/lib/fixtures";
import { CONTOUR_STEP } from "@/lib/explore/projection";
import { isCached, quantizeIndex, stormSurfaceAt, surfaceAt } from "@/lib/explore/surfaces";
import { Axes } from "./scene/Axes";
import { CriticGhost } from "./scene/CriticGhost";
import { PersonaAxes } from "./scene/PersonaAxes";
import { PersonaNodes } from "./scene/PersonaNodes";
import { Storm } from "./scene/Storm";
import { Terrain } from "./scene/Terrain";
import { Intro } from "./ui/Intro";
import { TimeScrubber } from "./ui/TimeScrubber";

const INTRO_KEY = "3dnight.intro.v1";

export default function ExploreApp() {
  const [timeIndex, setTimeIndex] = useState(LATEST_INDEX);
  const [stormActive, setStormActive] = useState(false);
  const [activeSurface, setActiveSurface] = useState<Surface | null>(null);
  const [stormSurf, setStormSurf] = useState<Surface | null>(null);
  const [computing, setComputing] = useState(false);
  const [introStep, setIntroStep] = useState<number | null>(null);
  // Bumped to remount the Canvas when a lost WebGL context never restores.
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const generation = useRef(0);
  const introChecked = useRef(false);
  const restoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const qi = quantizeIndex(timeIndex);

  // Base surface for the current moment. Cached hits land synchronously;
  // misses yield a frame first so the scrubber never stalls.
  useEffect(() => {
    const gen = ++generation.current;
    if (isCached("base", qi)) {
      setActiveSurface(surfaceAt(qi));
      setComputing(false);
      return;
    }
    setComputing(true);
    const id = setTimeout(() => {
      const s = surfaceAt(qi);
      if (generation.current === gen) {
        setActiveSurface(s);
        setComputing(false);
      }
    }, 30);
    return () => clearTimeout(id);
  }, [qi]);

  // Storm surface: computed when summoned (and kept current while active);
  // prefetched once shortly after load so the first summon lands instantly.
  useEffect(() => {
    if (!stormActive) return;
    if (isCached("storm", qi)) {
      setStormSurf(stormSurfaceAt(qi));
      return;
    }
    const id = setTimeout(() => setStormSurf(stormSurfaceAt(qi)), 40);
    return () => clearTimeout(id);
  }, [stormActive, qi]);

  // Prefetch the storm surface well after first paint — its main-thread
  // compute must never overlap GL setup and shader compilation.
  useEffect(() => {
    const id = setTimeout(() => {
      stormSurfaceAt(LATEST_INDEX);
    }, 5000);
    return () => clearTimeout(id);
  }, []);

  useEffect(
    () => () => {
      if (restoreTimer.current) clearTimeout(restoreTimer.current);
    },
    [],
  );

  // First visit: open the walkthrough once the loader clears. `?intro=1`
  // forces it; the ? button replays it any time.
  useEffect(() => {
    if (!activeSurface || introChecked.current) return;
    introChecked.current = true;
    const forced = new URLSearchParams(window.location.search).get("intro") === "1";
    if (forced || !window.localStorage.getItem(INTRO_KEY)) setIntroStep(0);
  }, [activeSurface]);

  const closeIntro = () => {
    window.localStorage.setItem(INTRO_KEY, "seen");
    setIntroStep(null);
  };

  // The surface the instruments should measure: mid-storm, the stressed one.
  const effSurface = stormActive && stormSurf ? stormSurf : activeSurface;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0a0a0c]">
      {/* The Canvas waits for the first surface: the 441-cell replay must
          not block the main thread while the GL context is initializing
          and shaders compile — that overlap is what killed the context on
          cold first visits. */}
      {activeSurface && (
        <Canvas
          key={canvasEpoch}
          dpr={[1, 2]}
          camera={{ fov: 42, position: [16.5, 12.5, 19] }}
          onCreated={({ gl }) => {
            // If a lost context never restores, remount the Canvas whole.
            const el = gl.domElement;
            el.addEventListener("webglcontextlost", () => {
              if (restoreTimer.current) clearTimeout(restoreTimer.current);
              restoreTimer.current = setTimeout(() => setCanvasEpoch((e) => e + 1), 1200);
            });
            el.addEventListener("webglcontextrestored", () => {
              if (restoreTimer.current) clearTimeout(restoreTimer.current);
            });
          }}
        >
          <color attach="background" args={["#0a0a0c"]} />
          <fog attach="fog" args={["#0a0a0c", 26, 48]} />
          <ambientLight intensity={0.35} />
          <directionalLight position={[6, 14, 4]} intensity={0.8} />
          {/* dim fill from the far corner so back slopes stay legible */}
          <directionalLight position={[-8, 6, -6]} intensity={0.18} />

          <Terrain
            surface={activeSurface}
            stormSurface={stormSurf}
            stormActive={stormActive}
            ghostSurface={stormActive ? activeSurface : null}
          />
          {effSurface && <Axes surface={effSurface} />}
          <PersonaAxes emphasize={introStep === 2} />
          <PersonaNodes timeIndex={timeIndex} showTrails />
          <Storm active={stormActive} />
          <CriticGhost surface={activeSurface} />

          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            enablePan={false}
            minDistance={8}
            maxDistance={32}
            maxPolarAngle={1.35}
            target={[0, 0.6, 0]}
          />
        </Canvas>
      )}

      {/* chrome */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-5">
        <div className="pointer-events-auto">
          <div className="font-mono text-[12px] tracking-tight text-[#e6e6ea]">
            3d-night <span className="text-[#55555e]">/ explore</span>
          </div>
          <Link
            href="/"
            className="font-mono text-[10px] tracking-[0.18em] text-[#9a9aa3] transition-colors hover:text-[#ffb224]"
          >
            ← DASHBOARD
          </Link>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setStormActive((s) => !s)}
            className={`border px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] transition-colors hover:text-[#e6e6ea] ${
              introStep === 3
                ? "animate-pulse border-[#ffb224] text-[#ffb224]"
                : "border-[#232329] text-[#9a9aa3] hover:border-[#55555e]"
            }`}
            style={stormActive ? { color: "#ffb224", borderColor: "#ffb224" } : undefined}
          >
            {stormActive ? "CLEAR SKIES" : "SUMMON BREAKER"}
          </button>
          <button
            onClick={() => setIntroStep(0)}
            aria-label="replay the intro"
            className="border border-[#232329] px-2.5 py-1.5 font-mono text-[10px] text-[#9a9aa3] transition-colors hover:border-[#55555e] hover:text-[#e6e6ea]"
          >
            ?
          </button>
        </div>
      </div>

      {introStep === null && (
        <div className="pointer-events-none absolute bottom-20 left-5 z-30 font-mono text-[10px] leading-relaxed">
          <div className="text-[#9a9aa3]">
            height = 5y return · waterline = break even · contour ={" "}
            {(CONTOUR_STEP * 100).toFixed(1)}%
          </div>
          <div className="text-[#9a9aa3]">amber tint = profit · flag = shipped strategy</div>
          <div className="text-[#55555e]">
            overhead: the fifty · x = view · z = slice read · y = conviction
          </div>
          <div className="text-[#55555e]">drag to orbit · scroll to zoom · hover a node</div>
        </div>
      )}

      {!activeSurface && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <span className="label-caps animate-pulse">replaying five years…</span>
        </div>
      )}

      {introStep !== null && (
        <Intro step={introStep} onStep={setIntroStep} onClose={closeIntro} />
      )}

      <TimeScrubber
        value={timeIndex}
        onChange={setTimeIndex}
        computing={computing}
        highlight={introStep === 4}
      />
    </div>
  );
}
