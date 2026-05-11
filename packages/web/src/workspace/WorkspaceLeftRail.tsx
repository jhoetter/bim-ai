import type { JSX, RefObject } from 'react';
import { useMemo, useState } from 'react';

import type { Element } from '@bim-ai/core';
import { Icons } from '@bim-ai/ui';
import {
  LevelHifi,
  PlanViewHifi,
  ScheduleViewHifi,
  SectionViewHifi,
  SheetHifi,
} from '@bim-ai/icons';

import { BUILT_IN_FAMILIES } from '../families/familyCatalog';
import { LevelStack } from '../levels/LevelStack';
import { useBimStore } from '../state/store';
import { LeftRail, type TopBarSelectOption, type WorkspaceMode } from './shell';
import { buildBrowserSections } from './workspaceUtils';

export function WorkspaceLeftRail({
  projectName,
  projectNameRef,
  onProjectNameClick,
  onSemanticCommand,
  openTabFromElement,
  onModeChange,
  onSetModeOnly,
  onOpenFamilyLibrary,
  perspectiveOptions,
  perspectiveValue,
  onPerspectiveChange,
  planStyleOptions,
  planStyleValue,
  onPlanStyleChange,
}: {
  projectName?: string;
  projectNameRef?: RefObject<HTMLButtonElement | null>;
  onProjectNameClick?: () => void;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  openTabFromElement: (el: Element) => void;
  onModeChange: (mode: WorkspaceMode) => void;
  /** Sets mode + viewerMode without touching tab state. Used after
   * `openTabFromElement` has already activated the correct tab, so that
   * `onModeChange` (which calls activateOrOpenKind) doesn't override it. */
  onSetModeOnly?: (mode: WorkspaceMode) => void;
  onOpenFamilyLibrary?: () => void;
  /** Discipline/perspective filter selector. */
  perspectiveOptions?: TopBarSelectOption[];
  perspectiveValue?: string;
  onPerspectiveChange?: (id: string) => void;
  /** Plan presentation style selector. */
  planStyleOptions?: TopBarSelectOption[];
  planStyleValue?: string;
  onPlanStyleChange?: (id: string) => void;
}): JSX.Element {
  const elementsById = useBimStore((s) => s.elementsById);
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const activatePlanView = useBimStore((s) => s.activatePlanView);
  const activePlanViewId = useBimStore((s) => s.activePlanViewId);
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

  const showDisciplineHeader =
    (perspectiveOptions && perspectiveOptions.length > 0) ||
    (planStyleOptions && planStyleOptions.length > 0);

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {projectName ? (
        <div className="shrink-0 border-b border-border p-2">
          <button
            type="button"
            ref={projectNameRef}
            onClick={onProjectNameClick}
            data-testid="primary-project-selector"
            className="flex w-full items-center gap-2 rounded border border-border bg-surface-strong px-2 py-1.5 text-left text-xs font-semibold text-foreground hover:bg-accent-soft"
            aria-haspopup="menu"
          >
            <span
              aria-hidden="true"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-accent text-[10px] font-bold text-accent-foreground"
            >
              BA
            </span>
            <span className="min-w-0 flex-1 truncate" title={projectName}>
              {projectName}
            </span>
            <Icons.disclosureOpen size={12} className="shrink-0 text-muted" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      {showDisciplineHeader ? (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-2 py-1.5">
          {perspectiveOptions &&
          perspectiveOptions.length > 0 &&
          perspectiveValue !== undefined &&
          onPerspectiveChange ? (
            <div className="relative flex flex-1 items-center">
              <select
                aria-label="Discipline"
                value={perspectiveValue}
                onChange={(e) => onPerspectiveChange(e.target.value)}
                className="h-6 w-full cursor-pointer appearance-none rounded border border-border bg-surface pl-2 pr-5 text-xs text-foreground hover:bg-surface-strong focus:outline-none"
              >
                {perspectiveOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Icons.disclosureOpen
                size={10}
                className="pointer-events-none absolute right-1 text-muted"
                aria-hidden="true"
              />
            </div>
          ) : null}
          {planStyleOptions &&
          planStyleOptions.length > 0 &&
          planStyleValue !== undefined &&
          onPlanStyleChange ? (
            <div className="relative flex flex-1 items-center">
              <select
                aria-label="Plan style"
                value={planStyleValue}
                onChange={(e) => onPlanStyleChange(e.target.value)}
                className="h-6 w-full cursor-pointer appearance-none rounded border border-border bg-surface pl-2 pr-5 text-xs text-foreground hover:bg-surface-strong focus:outline-none"
              >
                {planStyleOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Icons.disclosureOpen
                size={10}
                className="pointer-events-none absolute right-1 text-muted"
                aria-hidden="true"
              />
            </div>
          ) : null}
        </div>
      ) : null}
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
        <BrowserLegend />
        <LeftRail
          sections={browserSections}
          activeRowId={activeFamilyTypeId ?? activePlanViewId ?? selectedId ?? activeLevelId}
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
              activatePlanView(undefined);
              setActiveLevelId(id);
              openTabFromElement(el);
              onModeChange('plan');
              return;
            }
            if (el.kind === 'plan_view') {
              activatePlanView(id);
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

function BrowserLegend(): JSX.Element {
  const items = [
    { label: 'Datum', Icon: LevelHifi },
    { label: 'View', Icon: PlanViewHifi },
    { label: 'Sheet', Icon: SheetHifi },
    { label: 'Schedule', Icon: ScheduleViewHifi },
    { label: 'Cut', Icon: SectionViewHifi },
  ];
  return (
    <details className="border-b border-border bg-surface px-3 py-2 text-[10px] text-muted">
      <summary className="cursor-pointer font-medium text-foreground/80">Browser legend</summary>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {items.map(({ label, Icon }) => (
          <div key={label} className="flex items-center gap-1.5">
            <Icon size={22} aria-hidden="true" className="shrink-0 text-accent" />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </details>
  );
}
