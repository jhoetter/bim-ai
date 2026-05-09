import type { JSX } from 'react';
import { useMemo, useState } from 'react';

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
  onSetModeOnly,
  onOpenFamilyLibrary,
}: {
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  openTabFromElement: (el: Element) => void;
  onModeChange: (mode: WorkspaceMode) => void;
  /** Sets mode + viewerMode without touching tab state. Used after
   * `openTabFromElement` has already activated the correct tab, so that
   * `onModeChange` (which calls activateOrOpenKind) doesn't override it. */
  onSetModeOnly?: (mode: WorkspaceMode) => void;
  onOpenFamilyLibrary?: () => void;
}): JSX.Element {
  const elementsById = useBimStore((s) => s.elementsById);
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const selectedId = useBimStore((s) => s.selectedId);
  const select = useBimStore((s) => s.select);
  const setOrbitCameraFromViewpointMm = useBimStore((s) => s.setOrbitCameraFromViewpointMm);
  const setActiveViewpointId = useBimStore((s) => s.setActiveViewpointId);

  const browserSections = useMemo(() => buildBrowserSections(elementsById), [elementsById]);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const activeFamilyTypeId = useMemo(() => {
    if (!selectedId) return undefined;
    const el = elementsById[selectedId];
    if (!el) return undefined;
    if (el.kind === 'door' || el.kind === 'window') return el.familyTypeId ?? undefined;
    return undefined;
  }, [selectedId, elementsById]);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {onOpenFamilyLibrary ? (
        <div className="shrink-0 border-b border-border p-2">
          <button
            type="button"
            onClick={onOpenFamilyLibrary}
            data-testid="left-rail-open-family-library"
            className="w-full rounded border border-border bg-surface-strong px-2 py-1 text-left text-xs hover:bg-accent-soft"
          >
            Families…
          </button>
        </div>
      ) : null}
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
          onNameCommitted={(levelId, name) =>
            void onSemanticCommand({
              type: 'updateElementProperty',
              elementId: levelId,
              key: 'name',
              value: name,
            })
          }
          onCreatePlanView={(levelId, levelName) =>
            void onSemanticCommand({
              type: 'upsertPlanView',
              id: crypto.randomUUID(),
              name: `${levelName} — Plan`,
              levelId,
              discipline: 'architecture',
            })
          }
          onCreateLevel={() => {
            const sortedLevels = (Object.values(elementsById) as Element[])
              .filter((e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level')
              .sort((a, b) => a.elevationMm - b.elevationMm);
            const maxElev =
              sortedLevels.length > 0 ? sortedLevels[sortedLevels.length - 1]!.elevationMm : 0;
            const n = sortedLevels.length + 1;
            void onSemanticCommand({
              type: 'createLevel',
              id: crypto.randomUUID(),
              name: `Level ${n}`,
              elevationMm: maxElev + 3000,
              alsoCreatePlanView: true,
            });
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LeftRail
          sections={browserSections}
          activeRowId={activeFamilyTypeId ?? activeLevelId}
          onRowRename={(id) => {
            const el = elementsById[id];
            if (!el) return;
            if (el.kind === 'wall_type' || el.kind === 'floor_type' || el.kind === 'roof_type') {
              setRenameId(id);
              setRenameDraft(el.name);
            }
          }}
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
              onSetModeOnly?.('plan'); // change mode without overriding the active tab
              select(id);
              return;
            }
            if (el.kind === 'viewpoint') {
              openTabFromElement(el);
              onSetModeOnly?.('3d'); // change mode without overriding the active tab
              select(id);
              if (el.mode === 'orbit_3d' && el.camera) {
                setOrbitCameraFromViewpointMm({
                  position: el.camera.position,
                  target: el.camera.target,
                  up: el.camera.up,
                });
                setActiveViewpointId(el.id);
              }
              return;
            }
            if (el.kind === 'section_cut') {
              openTabFromElement(el);
              onSetModeOnly?.('section'); // change mode without overriding the active tab
              select(id);
              return;
            }
            if (el.kind === 'sheet') {
              openTabFromElement(el);
              onSetModeOnly?.('sheet'); // change mode without overriding the active tab
              select(id);
              return;
            }
            if (el.kind === 'schedule') {
              openTabFromElement(el);
              onSetModeOnly?.('schedule'); // change mode without overriding the active tab
              select(id);
              return;
            }
            select(id);
          }}
        />
      </div>
      {renameId && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 40,
            background: 'rgba(0,0,0,0.3)',
          }}
          onClick={() => setRenameId(null)}
        >
          <div
            style={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              minWidth: 200,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: 11, color: 'var(--color-muted)' }}>Rename type</span>
            <input
              autoFocus
              type="text"
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const trimmed = renameDraft.trim();
                  if (trimmed && renameId) {
                    void onSemanticCommand({
                      type: 'updateElementProperty',
                      elementId: renameId,
                      key: 'name',
                      value: trimmed,
                    });
                  }
                  setRenameId(null);
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setRenameId(null);
                }
              }}
              onBlur={() => {
                const trimmed = renameDraft.trim();
                if (trimmed && renameId) {
                  void onSemanticCommand({
                    type: 'updateElementProperty',
                    elementId: renameId,
                    key: 'name',
                    value: trimmed,
                  });
                }
                setRenameId(null);
              }}
              data-testid="type-rename-input"
            />
          </div>
        </div>
      )}
    </div>
  );
}
