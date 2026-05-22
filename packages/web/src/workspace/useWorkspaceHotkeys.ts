import { useEffect, useRef } from 'react';

import { modeForHotkey } from '../state/modeController';
import type { WorkspaceMode } from './shell';
import type { ToolDefinition } from '../tools/toolRegistry';
import type { PlanTool } from '../state/storeTypes';
import { closeTab, cycleActive, type TabsState } from './tabsModel';
import { canonicalPlanToolForMode } from './workspaceUtils';

type Setter<T> = (value: T | ((prev: T) => T)) => void;

export interface WorkspaceHotkeysOptions {
  effectiveMode: WorkspaceMode;
  toolRegistry: Record<string, ToolDefinition>;
  deleteSelectedElements: () => boolean;
  setFocusedPanePlanTool: (tool: PlanTool) => void;
  handleModeChange: (next: WorkspaceMode) => void;
  handleUndoRedo: (isUndo: boolean) => Promise<void> | void;
  openActiveVisibilityControls: () => void;
  toggleActivityDrawer: () => void;
  setOrthoSnapHold: (next: boolean) => void;
  setCheatsheetOpen: Setter<boolean>;
  setPaletteOpen: Setter<boolean>;
  setLibraryOpen: Setter<boolean>;
  setTabsState: Setter<TabsState>;
}

/**
 * Global keyboard hotkey wiring for the workspace shell:
 *  1–7 mode switches, ?, Cmd/Ctrl+K, Alt+2, Cmd/Ctrl+H/W/Z, V,
 *  and the tool hotkey + two-character chord (400 ms) palette.
 */
export function useWorkspaceHotkeys(options: WorkspaceHotkeysOptions): void {
  const {
    effectiveMode,
    toolRegistry,
    deleteSelectedElements,
    setFocusedPanePlanTool,
    handleModeChange,
    handleUndoRedo,
    openActiveVisibilityControls,
    toggleActivityDrawer,
    setOrthoSnapHold,
    setCheatsheetOpen,
    setPaletteOpen,
    setLibraryOpen,
    setTabsState,
  } = options;

  const pendingChordRef = useRef<string | null>(null);
  const pendingChordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent): void => {
      const target = event.target;
      if (target instanceof globalThis.HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        if (target.isContentEditable) return;
        if (target.closest('[role="dialog"]')) return;
      }
      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        effectiveMode !== 'plan'
      ) {
        if (deleteSelectedElements()) event.preventDefault();
        return;
      }
      if (
        event.key === 'Escape' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        setFocusedPanePlanTool('select' as PlanTool);
      }
      const fromMode = modeForHotkey(event.key);
      if (fromMode) {
        event.preventDefault();
        handleModeChange(fromMode as WorkspaceMode);
        return;
      }
      if (event.key === '?') {
        event.preventDefault();
        setCheatsheetOpen((v) => !v);
        return;
      }
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (event.key === '2' && event.altKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setLibraryOpen((v) => !v);
        return;
      }
      if ((event.key === 'h' || event.key === 'H') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleActivityDrawer();
        return;
      }
      if (event.key === 'Tab' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setTabsState((s) => cycleActive(s, event.shiftKey ? 'backward' : 'forward'));
        return;
      }
      if ((event.key === 'w' || event.key === 'W') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setTabsState((s) => (s.activeId ? closeTab(s, s.activeId) : s));
        return;
      }
      if ((event.key === 'z' || event.key === 'Z') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void handleUndoRedo(event.shiftKey ? false : true);
        return;
      }
      if (event.key === 'v' || event.key === 'V') {
        if (!event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          openActiveVisibilityControls();
          return;
        }
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (event.shiftKey) setOrthoSnapHold(true);

      const upper = event.key.length === 1 ? event.key.toUpperCase() : event.key;
      const hotkeyLabel = event.shiftKey ? `Shift+${upper}` : upper;
      const tools = Object.values(toolRegistry) as ToolDefinition[];

      if (pendingChordRef.current !== null && !event.shiftKey) {
        const chord = pendingChordRef.current + upper;
        clearTimeout(pendingChordTimerRef.current ?? undefined);
        pendingChordRef.current = null;
        pendingChordTimerRef.current = null;
        const chordTool = tools.find((t) => t.shortcut === chord);
        if (chordTool) {
          const tool = canonicalPlanToolForMode(chordTool.id, effectiveMode);
          if (tool) {
            event.preventDefault();
            setFocusedPanePlanTool(tool);
          }
        }
        return;
      }

      const hotkeyTool = tools.find((t) => t.hotkey === hotkeyLabel);
      const isChordStart =
        !event.shiftKey && tools.some((t) => t.shortcut?.length === 2 && t.shortcut[0] === upper);

      if (hotkeyTool && isChordStart) {
        event.preventDefault();
        pendingChordRef.current = upper;
        pendingChordTimerRef.current = setTimeout(() => {
          pendingChordRef.current = null;
          pendingChordTimerRef.current = null;
          const tool = canonicalPlanToolForMode(hotkeyTool.id, effectiveMode);
          if (tool) setFocusedPanePlanTool(tool);
        }, 400);
        return;
      }

      if (hotkeyTool) {
        const tool = canonicalPlanToolForMode(hotkeyTool.id, effectiveMode);
        if (tool) {
          event.preventDefault();
          setFocusedPanePlanTool(tool);
        }
        return;
      }

      if (isChordStart) {
        event.preventDefault();
        pendingChordRef.current = upper;
        pendingChordTimerRef.current = setTimeout(() => {
          pendingChordRef.current = null;
          pendingChordTimerRef.current = null;
        }, 400);
      }
    };
    const onKeyUp = (event: globalThis.KeyboardEvent): void => {
      if (!event.shiftKey) setOrthoSnapHold(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('keyup', onKeyUp);
      if (pendingChordTimerRef.current !== null) {
        clearTimeout(pendingChordTimerRef.current);
        pendingChordRef.current = null;
        pendingChordTimerRef.current = null;
      }
    };
  }, [
    deleteSelectedElements,
    effectiveMode,
    handleModeChange,
    handleUndoRedo,
    openActiveVisibilityControls,
    setCheatsheetOpen,
    setFocusedPanePlanTool,
    setLibraryOpen,
    setOrthoSnapHold,
    setPaletteOpen,
    setTabsState,
    toggleActivityDrawer,
    toolRegistry,
  ]);
}
