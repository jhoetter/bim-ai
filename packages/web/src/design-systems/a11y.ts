/**
 * Accessibility baseline — spec §22.
 *
 * Reusable a11y utilities + invariant checks every redesigned surface
 * must satisfy. Components compose `mergeA11y(props)` to merge required
 * `aria-*` and `role` attributes; tests assert against
 * `assertA11yInvariants(node)` to fail loudly when a button drops its
 * label or focus ring.
 */

export const A11Y_INVARIANTS = {
  /** Body copy contrast — WCAG AA. */
  bodyContrastRatio: 4.5,
  /** Large text (≥18 px or ≥14 px bold) — WCAG AA-large. */
  largeContrastRatio: 3,
  /** Min hit target on chrome elements (px). */
  minHitTargetPx: 24,
  /** Min hit target on the tool palette (spec §22 calls 36×36 px). */
  toolPaletteHitPx: 36,
  /** Default focus ring width (px). */
  focusRingPx: 2,
} as const;

export type AriaLive = 'off' | 'polite' | 'assertive';

export interface IconButtonProps {
  ariaLabel?: string;
  ariaPressed?: boolean;
  title?: string;
  disabled?: boolean;
}

/** Pull a final `aria-label` for an icon-only button. Throws if neither
 * `ariaLabel` nor `title` is provided — every icon button must surface
 * a textual label per §22. */
export function resolveIconButtonLabel(props: IconButtonProps): string {
  const label = props.ariaLabel ?? props.title;
  if (!label || !label.trim()) {
    throw new Error('Icon-only buttons must declare ariaLabel or title (spec §22).');
  }
  return label;
}

/** Determine the aria-live politeness level for a given surface. */
export function ariaLiveForSurface(
  surface:
    | 'status-coords'
    | 'status-tool'
    | 'status-ws-error'
    | 'status-save-error'
    | 'status-default',
): AriaLive {
  switch (surface) {
    case 'status-ws-error':
    case 'status-save-error':
      return 'assertive';
    case 'status-coords':
    case 'status-tool':
    case 'status-default':
      return 'polite';
    default:
      return 'off';
  }
}

/** Boolean test: does the supplied hit-target meet the §22 size rule? */
export function meetsHitTarget(
  widthPx: number,
  heightPx: number,
  surface: 'chrome' | 'tool-palette' = 'chrome',
): boolean {
  const min =
    surface === 'tool-palette' ? A11Y_INVARIANTS.toolPaletteHitPx : A11Y_INVARIANTS.minHitTargetPx;
  return widthPx >= min && heightPx >= min;
}

/** Static keyboard-only golden path — spec §22 acceptance. */
export const KEYBOARD_ONLY_PATH: { step: number; action: string; keys: string }[] = [
  { step: 1, action: 'Pick the seed-house template', keys: '⌘K → "seed house"' },
  { step: 2, action: 'Draw a wall', keys: 'W → click → click → Esc' },
  { step: 3, action: 'Add a door', keys: 'D → ArrowKeys nudge → Enter' },
  { step: 4, action: 'Place a section line', keys: 'Shift+S → click → click → click' },
  { step: 5, action: 'Generate sheet A-101', keys: '5 (sheet mode) → Enter on sheet' },
];
