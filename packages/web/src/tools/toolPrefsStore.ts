/**
 * CHR-V3-08 — toolPrefs zustand slice.
 *
 * Sticky-per-session modifier state for the ToolModifierBar.
 * Key layout: `toggles[toolId][modifierId]` → boolean
 *             `cycles[toolId][modifierId]` → string (current value)
 *
 * Tool switching restores the last-used modifier state for that tool;
 * state does not persist across page reloads (session-level).
 *
 * EDT-V3-05: `loopMode` is a session-level boolean that arms chained drawing
 * tools (Wall, Beam) to auto-restart after each completed segment.
 *
 * TOP-V3-03: `subdivisionDraft` holds the in-flight polygon being sketched
 * for a CreateToposolidSubdivisionCmd.
 */

import { create } from 'zustand';

export type SubdivisionFinishCategory = 'paving' | 'lawn' | 'road' | 'planting' | 'other';

export interface SubdivisionDraft {
  hostToposolidId: string | null;
  boundaryPts: { xMm: number; yMm: number }[];
  finishCategory: SubdivisionFinishCategory;
}

export interface ToolPrefsState {
  toggles: Record<string, Record<string, boolean>>;
  cycles: Record<string, Record<string, string>>;
  /** EDT-V3-05: when true, chained tools re-arm after each segment commit. */
  loopMode: boolean;
  /** UX-MC: status-bar Grid switch controls the visible drafting grid. */
  draftGridVisible: boolean;
  /** TOP-V3-03: in-flight subdivision polygon draft, null when not sketching. */
  subdivisionDraft: SubdivisionDraft | null;
  setToggle: (toolId: string, modifierId: string, value: boolean) => void;
  setCycle: (toolId: string, modifierId: string, value: string) => void;
  getToggle: (toolId: string, modifierId: string, defaultOn: boolean) => boolean;
  getCycle: (toolId: string, modifierId: string, defaultValue: string) => string;
  advanceCycle: (
    toolId: string,
    modifierId: string,
    values: readonly string[],
    defaultValue: string,
  ) => string;
  /** EDT-V3-05: set loop mode on/off. */
  setLoopMode: (v: boolean) => void;
  /** UX-MC: set or toggle drafting-grid visibility from status chrome. */
  setDraftGridVisible: (v: boolean) => void;
  toggleDraftGridVisible: () => void;
  /** TOP-V3-03: update the in-flight subdivision draft (replaces whole object). */
  setSubdivisionDraft: (draft: SubdivisionDraft) => void;
  /** TOP-V3-03: clear the in-flight subdivision draft. */
  clearSubdivisionDraft: () => void;
}

export const useToolPrefs = create<ToolPrefsState>((set, get) => ({
  toggles: {},
  cycles: {},
  loopMode: false,
  draftGridVisible: true,
  subdivisionDraft: null,

  setToggle(toolId, modifierId, value) {
    set((state) => ({
      toggles: {
        ...state.toggles,
        [toolId]: { ...state.toggles[toolId], [modifierId]: value },
      },
    }));
  },

  setCycle(toolId, modifierId, value) {
    set((state) => ({
      cycles: {
        ...state.cycles,
        [toolId]: { ...state.cycles[toolId], [modifierId]: value },
      },
    }));
  },

  getToggle(toolId, modifierId, defaultOn) {
    return get().toggles[toolId]?.[modifierId] ?? defaultOn;
  },

  getCycle(toolId, modifierId, defaultValue) {
    return get().cycles[toolId]?.[modifierId] ?? defaultValue;
  },

  advanceCycle(toolId, modifierId, values, defaultValue) {
    const current = get().getCycle(toolId, modifierId, defaultValue);
    const idx = values.indexOf(current);
    const next = values[(idx + 1) % values.length] ?? defaultValue;
    get().setCycle(toolId, modifierId, next);
    return next;
  },

  setLoopMode(v) {
    set({ loopMode: v });
  },

  setDraftGridVisible(v) {
    set({ draftGridVisible: v });
  },

  toggleDraftGridVisible() {
    set((state) => ({ draftGridVisible: !state.draftGridVisible }));
  },

  setSubdivisionDraft(draft) {
    set({ subdivisionDraft: draft });
  },

  clearSubdivisionDraft() {
    set({ subdivisionDraft: null });
  },
}));
