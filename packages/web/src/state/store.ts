import { create } from 'zustand';

import type { StoreState } from './storeTypes';
import { coerceElement, coerceViolation, defaultLevelId } from './storeCoercion';
import {
  createCollaborationRuntimeSlice,
  createPlanAuthoringRuntimeSlice,
  createWorkspaceUiRuntimeSlice,
} from './storeRuntimeSlices';
import { createModelRuntimeSlice } from './storeModelRuntimeSlice';
import { createViewportRuntimeSlice } from './storeViewportRuntimeSlice';

export type {
  PlanRoomSchemeWireReadout,
  ViewerMode,
  PlanTool,
  PresencePeers,
  UxComment,
  ActivityEvent,
  CategoryOverride,
  CategoryOverrides,
} from './storeTypes';

/** Theme controls live in `./theme.ts`. These exports preserve the
 * existing call-site API while delegating to the canonical module. */

export {
  initTheme as initThemeFromStorage,
  toggleTheme,
  applyTheme,
  getCurrentTheme,
  readPreferredTheme,
  prefersReducedMotion,
  type Theme,
} from './theme';

import { toggleTheme as _toggleTheme } from './theme';

/** Back-compat: returns `true` when the new theme is dark. */
export function toggleStoredTheme(): boolean {
  return _toggleTheme() === 'dark';
}

export function newPeerIdentity() {
  try {
    const k = crypto.randomUUID();

    return k;
  } catch {
    return `peer-${Math.random().toString(36).slice(2)}`;
  }
}

export const useBimStore = create<StoreState>((set, get) => {
  let peerIdStored = '';

  try {
    peerIdStored = sessionStorage.getItem('bim.peerId') ?? '';
  } catch {
    peerIdStored = '';
  }

  const peerSeed =
    peerIdStored ||
    (() => {
      const p = newPeerIdentity();

      try {
        sessionStorage.setItem('bim.peerId', p);
      } catch {
        /* noop */
      }

      return p;
    })();

  try {
    sessionStorage.setItem('bim.peerId', peerSeed);
  } catch {
    /* noop */
  }

  return {
    ...createModelRuntimeSlice(set, get, {
      coerceElement,
      coerceViolation,
      defaultLevelId,
    }),
    ...createPlanAuthoringRuntimeSlice(set),
    ...createCollaborationRuntimeSlice(set, peerSeed),
    ...createWorkspaceUiRuntimeSlice(set),
    ...createViewportRuntimeSlice(set, get),
  };
});

// E2E hook: expose the store on window so Playwright tests can drive
// viewpoint activation without UI interaction. Compiled out of release
// bundles via the DEV / E2E env check (VITE_E2E_DISABLE_WS doubles as a
// general "this is an e2e build" gate; production builds set neither).
try {
  const devFlag = Boolean(import.meta.env.DEV);
  const e2eFlag =
    typeof import.meta.env.VITE_E2E_DISABLE_WS === 'string' &&
    ['1', 'true', 'yes'].includes(import.meta.env.VITE_E2E_DISABLE_WS.trim().toLowerCase());
  if ((devFlag || e2eFlag) && typeof window !== 'undefined') {
    (window as unknown as { __bimStore?: typeof useBimStore }).__bimStore = useBimStore;
  }
} catch {
  /* noop */
}
