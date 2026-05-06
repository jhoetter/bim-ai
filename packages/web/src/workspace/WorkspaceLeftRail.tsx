import type { JSX } from 'react';
import { useMemo } from 'react';

import type { Element } from '@bim-ai/core';

import { BUILT_IN_FAMILIES } from '../families/familyCatalog';
import { LevelStack } from '../levels/LevelStack';
import { useBimStore } from '../state/store';
import { LeftRail } from './LeftRail';
import type { WorkspaceMode } from './TopBar';
import { buildBrowserSections } from './workspaceUtils';

export function WorkspaceLeftRail({
  onSemanticCommand,
  openTabFromElement,
  onModeChange,
}: {
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  openTabFromElement: (el: Element) => void;
  onModeChange: (mode: WorkspaceMode) => void;
}): JSX.Element {
  const elementsById = useBimStore((s) => s.elementsById);
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const selectedId = useBimStore((s) => s.selectedId);
  const select = useBimStore((s) => s.select);

  const browserSections = useMemo(() => buildBrowserSections(elementsById), [elementsById]);

  const activeFamilyTypeId = useMemo(() => {
    if (!selectedId) return undefined;
    const el = elementsById[selectedId];
    if (!el) return undefined;
    if (el.kind === 'door' || el.kind === 'window') return el.familyTypeId ?? undefined;
    return undefined;
  }, [selectedId, elementsById]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border p-2">
        <LevelStack
          levels={(Object.values(elementsById) as Element[])
            .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
            .sort((a, b) => a.elevationMm - b.elevationMm)}
          activeId={activeLevelId ?? ''}
          setActive={setActiveLevelId}
          onElevationCommitted={(levelId, elevationMm) =>
            void onSemanticCommand({ type: 'moveLevelElevation', levelId, elevationMm })
          }
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LeftRail
          sections={browserSections}
          activeRowId={activeFamilyTypeId ?? activeLevelId}
          onRowActivate={(id) => {
            if (id === 'new-wall-type') {
              void onSemanticCommand({
                type: 'upsertWallType',
                id: crypto.randomUUID(),
                name: 'New Wall Type',
                basisLine: 'center',
                layers: [{ thicknessMm: 200, function: 'structure', materialKey: '' }],
              });
              return;
            }
            if (id === 'new-floor-type') {
              void onSemanticCommand({
                type: 'upsertFloorType',
                id: crypto.randomUUID(),
                name: 'New Floor Type',
                layers: [{ thicknessMm: 200, function: 'structure', materialKey: '' }],
              });
              return;
            }
            if (id === 'new-roof-type') {
              void onSemanticCommand({
                type: 'upsertRoofType',
                id: crypto.randomUUID(),
                name: 'New Roof Type',
                layers: [{ thicknessMm: 200, function: 'structure', materialKey: '' }],
              });
              return;
            }
            const pickedType = BUILT_IN_FAMILIES.flatMap((f) => f.defaultTypes).find(
              (t) => t.id === id,
            );
            if (pickedType) {
              if (selectedId) {
                const selEl = elementsById[selectedId];
                if (selEl && selEl.kind === pickedType.discipline) {
                  void onSemanticCommand({
                    type: 'updateElementProperty',
                    elementId: selectedId,
                    key: 'familyTypeId',
                    value: id,
                  });
                }
              }
              return;
            }
            const el = elementsById[id];
            if (!el) {
              const isLevel = browserSections
                .find((s) => s.id === 'project')
                ?.rows.find((r) => r.id === 'levels')
                ?.children?.some((c) => c.id === id);
              if (isLevel) setActiveLevelId(id);
              return;
            }
            if (el.kind === 'level') {
              setActiveLevelId(id);
              openTabFromElement(el);
              onModeChange('plan');
              return;
            }
            if (el.kind === 'plan_view') {
              openTabFromElement(el);
              onModeChange('plan');
              select(id);
              return;
            }
            if (el.kind === 'viewpoint') {
              openTabFromElement(el);
              onModeChange('3d');
              select(id);
              return;
            }
            if (el.kind === 'section_cut') {
              openTabFromElement(el);
              onModeChange('section');
              select(id);
              return;
            }
            if (el.kind === 'sheet') {
              openTabFromElement(el);
              onModeChange('sheet');
              select(id);
              return;
            }
            if (el.kind === 'schedule') {
              openTabFromElement(el);
              onModeChange('schedule');
              select(id);
              return;
            }
            select(id);
          }}
        />
      </div>
    </div>
  );
}
