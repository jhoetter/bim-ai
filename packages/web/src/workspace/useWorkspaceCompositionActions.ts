import { useCallback, type Dispatch, type SetStateAction } from 'react';

import { EMPTY_TABS, type TabsState } from './tabsModel';
import { createPaneLayout, type PaneLayoutState } from './paneLayout';
import { nextCompositionId, type WorkspaceCompositionState } from './compositions';
import type { WorkspaceMode } from './shell';

type UseWorkspaceCompositionActionsArgs = {
  compositionState: WorkspaceCompositionState;
  finishCompositionLoadingSoon: (id: string) => void;
  markCompositionLoading: (id: string) => void;
  paneLayout: PaneLayoutState;
  runAfterLoadingPaint: (action: () => void, loadingId?: string) => void;
  setCompositionState: Dispatch<SetStateAction<WorkspaceCompositionState>>;
  setMode: Dispatch<SetStateAction<WorkspaceMode>>;
  setPaneLayout: Dispatch<SetStateAction<PaneLayoutState>>;
  setTabsState: Dispatch<SetStateAction<TabsState>>;
  setViewerMode: (mode: 'plan_canvas') => void;
  tabsState: TabsState;
};

export function useWorkspaceCompositionActions({
  compositionState,
  finishCompositionLoadingSoon,
  markCompositionLoading,
  paneLayout,
  runAfterLoadingPaint,
  setCompositionState,
  setMode,
  setPaneLayout,
  setTabsState,
  setViewerMode,
  tabsState,
}: UseWorkspaceCompositionActionsArgs) {
  const handleCompositionActivate = useCallback(
    (id: string) => {
      const next = compositionState.compositions.find((composition) => composition.id === id);
      if (!next || id === compositionState.activeId) return;
      markCompositionLoading(id);
      runAfterLoadingPaint(() => {
        setCompositionState((state) => ({
          activeId: id,
          compositions: state.compositions.map((composition) =>
            composition.id === state.activeId
              ? { ...composition, tabsState, paneLayout }
              : composition,
          ),
        }));
        setTabsState(next.tabsState);
        setPaneLayout(next.paneLayout);
      }, id);
    },
    [
      compositionState.activeId,
      compositionState.compositions,
      markCompositionLoading,
      paneLayout,
      runAfterLoadingPaint,
      setCompositionState,
      setPaneLayout,
      setTabsState,
      tabsState,
    ],
  );

  const handleCompositionCreate = useCallback(() => {
    const id = nextCompositionId();
    const pane = createPaneLayout(null);
    const label = `Composition ${compositionState.compositions.length + 1}`;
    markCompositionLoading(id);
    setCompositionState((state) => ({
      activeId: id,
      compositions: [
        ...state.compositions.map((composition) =>
          composition.id === state.activeId
            ? { ...composition, tabsState, paneLayout }
            : composition,
        ),
        { id, label, tabsState: EMPTY_TABS, paneLayout: pane },
      ],
    }));
    setTabsState(EMPTY_TABS);
    setPaneLayout(pane);
    setMode('plan');
    setViewerMode('plan_canvas');
    finishCompositionLoadingSoon(id);
  }, [
    compositionState.compositions.length,
    finishCompositionLoadingSoon,
    markCompositionLoading,
    paneLayout,
    setCompositionState,
    setMode,
    setPaneLayout,
    setTabsState,
    setViewerMode,
    tabsState,
  ]);

  const handleCompositionClose = useCallback(
    (id: string) => {
      const savedCompositions = compositionState.compositions.map((composition) =>
        composition.id === compositionState.activeId
          ? { ...composition, tabsState, paneLayout }
          : composition,
      );
      const closeIdx = savedCompositions.findIndex((composition) => composition.id === id);
      if (closeIdx === -1) return;

      const remaining = savedCompositions.filter((composition) => composition.id !== id);
      if (remaining.length === 0) {
        const fallbackPane = createPaneLayout(null);
        const fallbackId = nextCompositionId();
        setCompositionState({
          activeId: fallbackId,
          compositions: [
            {
              id: fallbackId,
              label: 'Composition 1',
              tabsState: EMPTY_TABS,
              paneLayout: fallbackPane,
            },
          ],
        });
        setTabsState(EMPTY_TABS);
        setPaneLayout(fallbackPane);
        setMode('plan');
        setViewerMode('plan_canvas');
        return;
      }

      if (id !== compositionState.activeId) {
        setCompositionState((state) => ({
          ...state,
          compositions: state.compositions
            .map((composition) =>
              composition.id === state.activeId
                ? { ...composition, tabsState, paneLayout }
                : composition,
            )
            .filter((composition) => composition.id !== id),
        }));
        return;
      }

      const nextIdx = Math.max(0, closeIdx - 1);
      const next = remaining[nextIdx] ?? remaining[0]!;
      markCompositionLoading(next.id);
      runAfterLoadingPaint(() => {
        setCompositionState({ activeId: next.id, compositions: remaining });
        setTabsState(next.tabsState);
        setPaneLayout(next.paneLayout);
      }, next.id);
    },
    [
      compositionState.activeId,
      compositionState.compositions,
      markCompositionLoading,
      paneLayout,
      runAfterLoadingPaint,
      setCompositionState,
      setMode,
      setPaneLayout,
      setTabsState,
      setViewerMode,
      tabsState,
    ],
  );

  const handleCompositionReorder = useCallback(
    (fromIdx: number, toIdx: number) => {
      setCompositionState((state) => {
        const len = state.compositions.length;
        const from = Math.max(0, Math.min(len - 1, fromIdx));
        const to = Math.max(0, Math.min(len - 1, toIdx));
        if (from === to) return state;
        const compositions = [...state.compositions];
        const [moved] = compositions.splice(from, 1);
        if (!moved) return state;
        compositions.splice(to, 0, moved);
        return { ...state, compositions };
      });
    },
    [setCompositionState],
  );

  const handleCompositionRename = useCallback(
    (id: string, label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      setCompositionState((state) => ({
        ...state,
        compositions: state.compositions.map((composition) =>
          composition.id === id ? { ...composition, label: trimmed } : composition,
        ),
      }));
    },
    [setCompositionState],
  );

  return {
    handleCompositionActivate,
    handleCompositionClose,
    handleCompositionCreate,
    handleCompositionRename,
    handleCompositionReorder,
  };
}
