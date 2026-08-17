"use client";

/**
 * Every label in the scene goes through this wrapper, so one file owns the
 * font decision, the fog exemption and the SDF prewarm.
 *
 * troika needs a real font file — the CSS variable from next/font is
 * useless to it — and it cannot parse woff2, so the repo ships JetBrains
 * Mono as a TTF. Fog is disabled on all label material: axis furniture is
 * chrome, and chrome shouldn't dim with distance.
 */
import { Billboard, Text } from "@react-three/drei";
import { memo } from "react";
import { INK3D } from "@/lib/explore/ink";

export const SCENE_FONT = "/fonts/JetBrainsMono-Regular.ttf";

/** Pre-warmed glyph set: every string the axis furniture can render. */
const CHARACTERS = "0123456789+−-.%×·dabcdefghijklmnopqrstuvwxyz ←→=";

type Variant = "title" | "tick" | "micro" | "accent";

const VARIANT: Record<Variant, { size: number; color: string }> = {
  title: { size: 0.34, color: INK3D.fg },
  tick: { size: 0.24, color: INK3D.muted },
  micro: { size: 0.2, color: INK3D.muted },
  accent: { size: 0.26, color: INK3D.accent },
};

export interface SceneTextProps {
  children: string;
  variant?: Variant;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Face the camera instead of lying in a fixed plane. */
  billboard?: boolean;
  color?: string;
  fontSize?: number;
  opacity?: number;
  anchorX?: "left" | "center" | "right";
  anchorY?: "top" | "middle" | "bottom";
  letterSpacing?: number;
}

export const SceneText = memo(function SceneText({
  children,
  variant = "tick",
  position,
  rotation,
  billboard = false,
  color,
  fontSize,
  opacity = 1,
  anchorX = "center",
  anchorY = "middle",
  letterSpacing = 0.02,
}: SceneTextProps) {
  const v = VARIANT[variant];
  const label = (
    <Text
      font={SCENE_FONT}
      characters={CHARACTERS}
      fontSize={fontSize ?? v.size}
      color={color ?? v.color}
      anchorX={anchorX}
      anchorY={anchorY}
      letterSpacing={letterSpacing}
      position={billboard ? undefined : position}
      rotation={billboard ? undefined : rotation}
      fillOpacity={opacity}
      // Chrome: never fogged, never writes depth over the terrain.
      material-fog={false}
      material-depthWrite={false}
      material-transparent
      renderOrder={10}
    >
      {children}
    </Text>
  );
  if (!billboard) return label;
  return (
    <Billboard position={position} follow>
      {label}
    </Billboard>
  );
});
