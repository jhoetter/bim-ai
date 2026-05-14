/**
 * Visual regression baseline manifest — spec §28 last row + §31 step 3.
 *
 * Static catalogue of every redesigned surface that needs a Playwright
 * `toHaveScreenshot` baseline. Tests cross-reference this so the harness
 * stays in lockstep with the spec table.
 */

export interface VisualBaselineEntry {
  /** Stable id matching the Playwright snapshot file. */
  id: string;
  /** Spec section that drives the surface. */
  specSection: string;
  /** Workspace mode under which the surface is captured. */
  mode: 'plan' | '3d' | 'section' | 'sheet' | 'schedule';
  /** Theme variant — both light and dark must baseline per §22 / §23. */
  theme: 'light' | 'dark';
  /** Reference viewport size (px). Spec §8 calls 1440 wide as the
   * canonical capture; 1024 + 1920 are spot-checked elsewhere. */
  viewport: { widthPx: number; heightPx: number };
}

export const VISUAL_BASELINES: VisualBaselineEntry[] = [
  {
    id: 'app-shell-light',
    specSection: '§8',
    mode: 'plan',
    theme: 'light',
    viewport: { widthPx: 1440, heightPx: 900 },
  },
  {
    id: 'app-shell-dark',
    specSection: '§8',
    mode: 'plan',
    theme: 'dark',
    viewport: { widthPx: 1440, heightPx: 900 },
  },
  {
    id: 'top-bar-light',
    specSection: '§11',
    mode: 'plan',
    theme: 'light',
    viewport: { widthPx: 1440, heightPx: 64 },
  },
  {
    id: 'left-rail-light',
    specSection: '§12',
    mode: 'plan',
    theme: 'light',
    viewport: { widthPx: 280, heightPx: 900 },
  },
  {
    id: 'right-rail-light',
    specSection: '§13',
    mode: 'plan',
    theme: 'light',
    viewport: { widthPx: 320, heightPx: 900 },
  },
  {
    id: 'status-bar-light',
    specSection: '§17',
    mode: 'plan',
    theme: 'light',
    viewport: { widthPx: 1440, heightPx: 32 },
  },
  {
    id: 'tool-palette-light',
    specSection: '§16',
    mode: 'plan',
    theme: 'light',
    viewport: { widthPx: 720, heightPx: 64 },
  },
  {
    id: 'plan-canvas-1to100',
    specSection: '§14',
    mode: 'plan',
    theme: 'light',
    viewport: { widthPx: 1024, heightPx: 720 },
  },
  {
    id: '3d-viewport-default-orbit',
    specSection: '§15',
    mode: '3d',
    theme: 'light',
    viewport: { widthPx: 1024, heightPx: 720 },
  },
];

/** Lookup helper — returns null when the surface is absent. */
export function baselineById(id: string): VisualBaselineEntry | null {
  return VISUAL_BASELINES.find((b) => b.id === id) ?? null;
}
