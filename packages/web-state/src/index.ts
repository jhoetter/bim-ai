/**
 * @bim-ai/web-state — public API.
 *
 * This package is the lowest layer of the `packages/web` split (ARCH-CQ-05).
 * It MUST NOT import from `packages/web/src/**` — see the
 * `web-state-self-contained` rule in
 * `spec/governance/architecture-boundaries.json`.
 *
 * Scope today (ARCH-CQ-05-a, first slice): only the truly leaf utilities
 * — theming, shallow-selector hook, UI-state palette, render-count probe,
 * checkpoint-retention coercion, model-index builders. The Zustand store
 * proper (`store.ts`, `storeTypes.ts`, `storeRuntimeSlices.ts`, etc.) is
 * still under `packages/web/src/state/` because `storeTypes.ts` imports
 * from sibling dirs (`families`, `groups`, `plan`, `tools`, `viewport`,
 * `workspace`). It will migrate once those sibling packages are extracted
 * in ARCH-CQ-05-b / -c / -d (or once `storeTypes` is de-coupled). See the
 * sub-WP tracker entry for the residual plan.
 */
export {
  DEFAULT_CHECKPOINT_RETENTION_LIMIT,
  MIN_CHECKPOINT_RETENTION_LIMIT,
  MAX_CHECKPOINT_RETENTION_LIMIT,
  coerceCheckpointRetentionLimit,
} from './backupRetention';

export { EMPTY_MODEL_INDICES, buildModelIndices, type ModelIndices } from './modelIndices';

export {
  useRenderCount,
  readRenderCountProbe,
  resetRenderCountProbe,
  type RenderCountSample,
} from './renderCountProbe';

export {
  THEME_VALUES,
  readPreferredTheme,
  applyTheme,
  getCurrentTheme,
  toggleTheme,
  initTheme,
  prefersReducedMotion,
  type Theme,
} from './theme';

export {
  UI_STATE_PATTERNS,
  patternFor,
  type UiStateKind,
  type UiStateSeverity,
  type UiStatePattern,
} from './uiStates';

export { useShallowSelector } from './useShallowSelector';

export { useTheme } from './useTheme';
