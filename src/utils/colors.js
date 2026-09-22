// Preset project colors — 6 visually distinct options offered when creating
// a project, cycled through so each new project gets a different default. A
// 7th "custom" swatch (rendered by ColorSwatchPicker) lets you pick any hex
// beyond this set.
export const PROJECT_COLORS = [
  '#EF4444', // red
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
]

// Lighten a hex color toward white so it reads as a pastel fill (used as the
// task bar background) while keeping dark text on top legible.
export function pastelize(hex, amount = 0.78) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!m) return hex
  const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16))
  const mix = (c) => Math.round(c + (255 - c) * amount)
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`
}

// Black or white — whichever reads better on top of a solid fill of `hex`.
// Presets and custom colors alike span light and dark hues (an amber or a
// pastel-ish custom pick is too light for white text), so a fixed text color
// can't work for every project color; this picks per-color instead.
export function readableTextColor(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  if (!m) return '#ffffff'
  const [r, g, b] = [m[1], m[2], m[3]].map(h => parseInt(h, 16))
  // Perceived brightness (YIQ) — a common, cheap luminance-ish heuristic.
  const yiq = (r * 299 + g * 587 + b * 114) / 1000
  return yiq >= 150 ? '#111827' : '#ffffff'
}
