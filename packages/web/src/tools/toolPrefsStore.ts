/**
 * CHR-V3-08 — toolPrefs zustand slice.
 *
 * Sticky-per-session modifier state for the ToolModifierBar.
 * Key layout: `toggles[toolId][modifierId]` → boolean
 *             `cycles[toolId][modifierId]` → string (current value)
 *
 * Tool switching restores the last-used modifier state for that tool;
 * state does not persist across page reloads (session-level).
 */

import { create } from 'zustand';

export interface ToolPrefsState {
  toggles: Record<string, Record<string, boolean>>;
  cycles: Record<string, Record<string, string>>;
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
}

export const useToolPrefs = create<ToolPrefsState>((set, get) => ({
  toggles: {},
  cycles: {},

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
}));
