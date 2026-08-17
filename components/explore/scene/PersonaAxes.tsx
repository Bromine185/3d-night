"use client";

/**
 * The floating layer's own coordinate frame. The fifty reuse the terrain's
 * world box with entirely different axes — x is view (short → long), z is
 * which slice the reader works, height is conviction — and nothing about
 * the nodes says so. A second hairline ground at the layer's floor, band
 * separators, and end labels make the break in coordinate systems visible.
 *
 * `emphasize` (used by the intro's "the fifty" step) raises the frame from
 * a whisper to a statement.
 */
import { useMemo } from "react";
import { FAMILY_ORDER, FAMILY_SHORT } from "@/lib/agents/personas";
import { INK3D } from "@/lib/explore/ink";
import { PERSONA_FLOOR_Y, SPAN } from "@/lib/explore/projection";
import { Segs } from "./Axes";
import { SceneText } from "./SceneText";

const FRAME_Y = PERSONA_FLOOR_Y - 0.3;

export function PersonaAxes({ emphasize = false }: { emphasize?: boolean }) {
  const lineOpacity = emphasize ? 0.55 : 0.22;
  const textOpacity = emphasize ? 1 : 0.7;

  const pts = useMemo(() => {
    const p: number[] = [];
    const y = FRAME_Y;
    // the frame
    p.push(-SPAN, y, -SPAN, SPAN, y, -SPAN);
    p.push(SPAN, y, -SPAN, SPAN, y, SPAN);
    p.push(SPAN, y, SPAN, -SPAN, y, SPAN);
    p.push(-SPAN, y, SPAN, -SPAN, y, -SPAN);
    // nine interior band separators — ten slices
    for (let k = 1; k < 10; k++) {
      const z = -SPAN + k * 2;
      p.push(-SPAN, y, z, SPAN, y, z);
    }
    // the view axis' zero: flat opinion
    p.push(0, y, -SPAN, 0, y, SPAN);
    return p;
  }, []);

  return (
    <group>
      <Segs pts={pts} color={INK3D.rule} opacity={lineOpacity} />

      {/* view axis ends — same words the dashboard's signal strip uses */}
      <SceneText billboard position={[-SPAN - 1.3, FRAME_Y, 0]} opacity={textOpacity}>
        ← short
      </SceneText>
      <SceneText billboard position={[SPAN + 1.3, FRAME_Y, 0]} opacity={textOpacity}>
        long →
      </SceneText>

      {/* one label per slice band */}
      {FAMILY_ORDER.map((f, i) => (
        <SceneText
          key={f}
          billboard
          variant="micro"
          position={[-SPAN - 1.1, FRAME_Y, -SPAN + (i + 0.5) * 2]}
          opacity={textOpacity * 0.85}
        >
          {FAMILY_SHORT[f]}
        </SceneText>
      ))}

      <SceneText
        billboard
        variant="micro"
        position={[0, FRAME_Y + 3.6, 0]}
        opacity={textOpacity}
        color={INK3D.muted}
      >
        the fifty · x = view · z = slice read · height = conviction
      </SceneText>
    </group>
  );
}
