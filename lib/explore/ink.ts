/**
 * The 3D scene's palette. Three.js materials can't read CSS custom
 * properties, so the tokens from globals.css are restated here — one
 * place, instead of hex literals scattered through scene files.
 */
export const INK3D = {
  fg: "#e6e6ea",
  muted: "#9a9aa3",
  faint: "#55555e",
  rule: "#38383f",
  hairline: "#232329",
  accent: "#ffb224",
  bg: "#0a0a0c",
} as const;
