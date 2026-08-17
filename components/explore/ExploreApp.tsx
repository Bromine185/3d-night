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
import { isCached, quantizeIndex, stormSurfaceAt, surfaceAt } from "@/lib/explore/surfaces";
import { CriticGhost } from "./scene/CriticGhost";
import { PersonaNodes } from "./scene/PersonaNodes";
import { Storm } from "./scene/Storm";
import { Terrain } from "./scene/Terrain";
import { TimeScrubber } from "./ui/TimeScrubber";

export default function ExploreApp() {
  const [timeIndex, setTimeIndex] = useState(LATEST_INDEX);
  const [stormActive, setStormActive] = useState(false);
  const [activeSurface, setActiveSurface] = useState<Surface | null>(null);
  const [stormSurf, setStormSurf] = useState<Surface | null>(null);
  const [computing, setComputing] = useState(false);
  const generation = useRef(0);

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

  useEffect(() => {
    const id = setTimeout(() => {
      stormSurfaceAt(LATEST_INDEX);
    }, 1600);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0a0a0c]">
      <Canvas dpr={[1, 2]} camera={{ fov: 42, position: [14, 11, 16] }}>
        <color attach="background" args={["#0a0a0c"]} />
        <fog attach="fog" args={["#0a0a0c", 26, 48]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[6, 14, 4]} intensity={0.8} />
        {/* dim fill from the far corner so back slopes stay legible */}
        <directionalLight position={[-8, 6, -6]} intensity={0.18} />

        {activeSurface && (
          <Terrain
            surface={activeSurface}
            stormSurface={stormSurf}
            stormActive={stormActive}
            ghostSurface={stormActive ? activeSurface : null}
          />
        )}
        <PersonaNodes timeIndex={timeIndex} showTrails />
        <Storm active={stormActive} />
        <CriticGhost surface={activeSurface} />

        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          enablePan={false}
          minDistance={8}
          maxDistance={40}
          maxPolarAngle={1.35}
          target={[0, 0.6, 0]}
        />
      </Canvas>

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
        <button
          onClick={() => setStormActive((s) => !s)}
          className="pointer-events-auto border border-[#232329] px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] text-[#9a9aa3] transition-colors hover:border-[#55555e] hover:text-[#e6e6ea]"
          style={stormActive ? { color: "#ffb224", borderColor: "#ffb224" } : undefined}
        >
          {stormActive ? "CLEAR SKIES" : "SUMMON BREAKER"}
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-20 left-5 z-30 font-mono text-[10px] leading-relaxed text-[#55555e]">
        height = realized return · x = entry threshold · z = holding period
        <br />
        nodes = the fifty, placed by view · drag to orbit, scroll to zoom
      </div>

      {!activeSurface && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <span className="label-caps animate-pulse">replaying five years…</span>
        </div>
      )}

      <TimeScrubber value={timeIndex} onChange={setTimeIndex} computing={computing} />
    </div>
  );
}
