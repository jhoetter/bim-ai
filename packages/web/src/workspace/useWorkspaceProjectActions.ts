import { useCallback } from 'react';
import type { Element, Snapshot } from '@bim-ai/core';

import { exportToDxf } from '../export/dxfExporter';
import { exportSceneToDgn } from '../export/dgnExporter';
import { exportToIfc } from '../export/ifcExporter';
import { useBimStore } from '../state/store';
import { exportSceneToDwg } from '../viewport/dwgExport';
import { EMPTY_TABS, type TabsState } from './tabsModel';
import {
  buildSnapshotPayload,
  downloadSnapshot,
  findRecentProject,
  type ProjectMenuItemRecent,
  pushRecentProject,
  pushRollingSnapshotBackup,
  readRecentProjects,
  readSnapshotFile,
} from './project';

type LevelElement = Extract<Element, { kind: 'level' }>;

export function useWorkspaceProjectActions({
  activeSeedLabel,
  saveAsMaximumBackups,
  hydrateFromSnapshot,
  setSeedError,
  setRecentProjects,
  setTabsState,
}: {
  activeSeedLabel: string | null | undefined;
  saveAsMaximumBackups: number;
  hydrateFromSnapshot: (snapshot: Snapshot) => void;
  setSeedError: (message: string | null) => void;
  setRecentProjects: (projects: ProjectMenuItemRecent[]) => void;
  setTabsState: (tabsState: TabsState) => void;
}) {
  const handleSaveSnapshot = useCallback(() => {
    const st = useBimStore.getState();
    if (!st.modelId) {
      setSeedError('Nothing to save — bootstrap a model first.');
      return;
    }
    const snap: Snapshot = {
      modelId: st.modelId,
      revision: st.revision ?? 0,
      elements: st.elementsById as unknown as Record<string, unknown>,
      violations: [],
    };
    const payload = buildSnapshotPayload(snap, undefined, {
      maximumBackups: saveAsMaximumBackups,
    });
    const { payload: rollingPayload } = pushRollingSnapshotBackup(payload, saveAsMaximumBackups);
    downloadSnapshot(rollingPayload);
    const next = pushRecentProject(rollingPayload);
    setRecentProjects(next.map((r) => ({ id: r.id, label: r.label })));
  }, [saveAsMaximumBackups, setRecentProjects, setSeedError]);

  const handleExportIfc = useCallback(() => {
    const els = useBimStore.getState().elementsById;
    const step = exportToIfc(els as Parameters<typeof exportToIfc>[0]);
    const blob = new Blob([step], { type: 'application/step' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSeedLabel ?? 'project'}.ifc`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeSeedLabel]);

  const handleExportDxf = useCallback(
    (opts: { levelId?: string; units: 'mm' | 'm' }) => {
      const els = useBimStore.getState().elementsById;
      const views = exportToDxf(els as Parameters<typeof exportToDxf>[0], {
        levelId: opts.levelId,
        units: opts.units,
      });
      for (const view of views) {
        const blob = new Blob([view.dxfContent], { type: 'application/dxf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeSeedLabel ?? 'project'}-${view.levelName}.dxf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    },
    [activeSeedLabel],
  );

  const handleExportDwg = useCallback(() => {
    const els = useBimStore.getState().elementsById;
    exportSceneToDwg(els as Parameters<typeof exportSceneToDwg>[0]);
  }, []);

  const handleExportDgn = useCallback(() => {
    const { elementsById } = useBimStore.getState();
    const levels = Object.values(elementsById)
      .filter((e): e is LevelElement => e.kind === 'level')
      .sort((a, b) => a.elevationMm - b.elevationMm);
    const content = exportSceneToDgn(elementsById, levels);
    const blob = new Blob([content], { type: 'application/dgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.dgn';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleRestoreSnapshot = useCallback(
    async (file: File): Promise<void> => {
      try {
        const payload = await readSnapshotFile(file);
        hydrateFromSnapshot(payload.snapshot);
        const next = pushRecentProject(payload);
        setRecentProjects(next.map((r) => ({ id: r.id, label: r.label })));
      } catch (err) {
        setSeedError(err instanceof Error ? err.message : 'Failed to read snapshot');
      }
    },
    [hydrateFromSnapshot, setRecentProjects, setSeedError],
  );

  const handlePickRecent = useCallback(
    (id: string) => {
      const found = findRecentProject(id);
      if (!found) return;
      hydrateFromSnapshot(found.payload.snapshot);
    },
    [hydrateFromSnapshot],
  );

  const handleNewClear = useCallback(() => {
    hydrateFromSnapshot({ modelId: 'empty', revision: 0, elements: {}, violations: [] });
    setTabsState(EMPTY_TABS);
  }, [hydrateFromSnapshot, setTabsState]);

  const handleDuplicateProject = useCallback(
    (newName: string) => {
      const st = useBimStore.getState();
      if (!st.modelId) {
        setSeedError('Nothing to duplicate — bootstrap a model first.');
        return;
      }
      const newId = crypto.randomUUID();
      const snap: Snapshot = {
        modelId: newId,
        revision: 0,
        elements: st.elementsById as unknown as Record<string, unknown>,
        violations: [],
      };
      const payload = buildSnapshotPayload(snap, newName);
      const next = pushRecentProject(payload);
      setRecentProjects(next.map((r) => ({ id: r.id, label: r.label })));
    },
    [setRecentProjects, setSeedError],
  );

  const handleRevertProject = useCallback(() => {
    const recent = readRecentProjects();
    const st = useBimStore.getState();
    const currentModelId = st.modelId;
    const match =
      recent.find(
        (r) =>
          r.payload.snapshot.modelId === currentModelId || r.payload.snapshot.modelId === 'empty',
      ) ?? recent[0];
    if (match) {
      hydrateFromSnapshot(match.payload.snapshot);
    }
  }, [hydrateFromSnapshot]);

  return {
    handleSaveSnapshot,
    handleExportIfc,
    handleExportDxf,
    handleExportDwg,
    handleExportDgn,
    handleRestoreSnapshot,
    handlePickRecent,
    handleNewClear,
    handleDuplicateProject,
    handleRevertProject,
  };
}
