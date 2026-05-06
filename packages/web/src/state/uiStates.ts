/**
 * Empty / loading / error states — spec §25.
 *
 * Canonical content (headline, hint, primary CTA, severity) per
 * documented surface. The corresponding React renderer composes a
 * StateBlock against this catalogue.
 */

export type UiStateKind =
  | 'canvas-empty'
  | 'canvas-loading'
  | 'network-offline'
  | 'engine-error'
  | 'conflict-409'
  | 'permission-denied';

export type UiStateSeverity = 'info' | 'warning' | 'danger';

export interface UiStatePattern {
  kind: UiStateKind;
  severity: UiStateSeverity;
  headline: string;
  hint: string;
  cta?: { label: string; intent: 'primary' | 'secondary'; action: string };
  /** Aria-live politeness expected for this state. */
  ariaLive: 'polite' | 'assertive' | 'off';
}

export const UI_STATE_PATTERNS: Record<UiStateKind, UiStatePattern> = {
  'canvas-empty': {
    kind: 'canvas-empty',
    severity: 'info',
    headline: 'This level is empty.',
    hint: 'Press W to draw a wall, click "Insert seed house" below, or use the project menu (top-left BIM AI seed ▾).',
    cta: { label: 'Insert seed house', intent: 'primary', action: 'project.insert-seed' },
    ariaLive: 'off',
  },
  'canvas-loading': {
    kind: 'canvas-loading',
    severity: 'info',
    headline: 'Loading model…',
    hint: 'Streaming geometry from the engine.',
    ariaLive: 'polite',
  },
  'network-offline': {
    kind: 'network-offline',
    severity: 'warning',
    headline: 'Network connection lost.',
    hint: 'Local edits remain queued; we will resync as soon as you are back online.',
    cta: { label: 'Retry', intent: 'secondary', action: 'network.retry' },
    ariaLive: 'assertive',
  },
  'engine-error': {
    kind: 'engine-error',
    severity: 'danger',
    headline: 'The engine returned an error.',
    hint: 'Copy the diagnostics or reload to try again. Your local changes are preserved.',
    cta: { label: 'Copy diagnostics', intent: 'secondary', action: 'engine.copy-diagnostics' },
    ariaLive: 'assertive',
  },
  'conflict-409': {
    kind: 'conflict-409',
    severity: 'warning',
    headline: 'Server-side conflict detected.',
    hint: 'A newer revision exists. Reload to continue editing.',
    cta: { label: 'Reload', intent: 'primary', action: 'document.reload' },
    ariaLive: 'assertive',
  },
  'permission-denied': {
    kind: 'permission-denied',
    severity: 'danger',
    headline: 'This project is read-only.',
    hint: 'Save a copy to make changes.',
    cta: { label: 'Save a copy', intent: 'primary', action: 'document.save-copy' },
    ariaLive: 'assertive',
  },
};

export function patternFor(kind: UiStateKind): UiStatePattern {
  return UI_STATE_PATTERNS[kind];
}
