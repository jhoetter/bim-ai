/**
 * D8 - Color Fill Scheme: legend utilities.
 *
 * Generates legend rows from a colorMap (category value -> hex color).
 */

export type ColorFillLegendRow = {
  /** The raw category value, e.g. a room name, department name, or area bucket. */
  value: string;
  /** Hex color string, e.g. "#4A90D9". */
  color: string;
  /** Human-readable label (same as value; reserved for future localisation). */
  label: string;
};

/**
 * Build a sorted legend row array from a colorMap.
 * Rows are sorted alphabetically by value so the legend is stable.
 */
export function buildColorFillLegend(colorMap: Record<string, string>): ColorFillLegendRow[] {
  return Object.entries(colorMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, color]) => ({ value, color, label: value }));
}
