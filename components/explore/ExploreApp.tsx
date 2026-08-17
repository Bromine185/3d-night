"use client";

/**
 * The exploration mode. One scene: the strategy's parameter space as terrain.
 * The agents arrive in later commits — nodes, storm, ghost, scrubber — each
 * mounting as one self-contained element.
 */
import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Surface } from "@/lib/agents/types";
import { baseSurface } from "@/lib/explore/surfaces";
import { PersonaNodes } from "./scene/PersonaNodes";
import { Terrain } from "./scene/Terrain";

export default function ExploreApp() {
  const [activeSurface, setActiveSurface] = useState<Surface | null>(null);

  // The full five-year replay across the whole grid — computed once, off the
  // first paint so the loading line shows instead of a frozen tab.
  useEffect(() => {
    const id = setTimeout(() => setActiveSurface(baseSurface()), 30);
    return () => clearTimeout(id);
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0a0a0c]">
      <Canvas dpr={[1, 2]} camera={{ fov: 42, position: [14, 11, 16] }}>
        <color attach="background" args={["#0a0a0c"]} />
        <fog attach="fog" args={["#0a0a0c", 26, 48]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[6, 14, 4]} intensity={0.8} />

        {activeSurface && <Terrain surface={activeSurface} />}
        <PersonaNodes />

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
      </div>

      <div className="pointer-events-none absolute bottom-6 left-5 z-30 font-mono text-[10px] leading-relaxed text-[#55555e]">
        height = realized return · x = entry threshold · z = holding period
        <br />
        nodes = the fifty, placed by view · drag to orbit, scroll to zoom
      </div>

      {!activeSurface && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <span className="label-caps animate-pulse">replaying five years…</span>
        </div>
      )}
    </div>
  );
}
