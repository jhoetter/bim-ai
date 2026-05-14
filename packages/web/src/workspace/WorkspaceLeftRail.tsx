import type { JSX, RefObject } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Element } from '@bim-ai/core';
import { Icons } from '@bim-ai/ui';

import { useBimStore } from '../state/store';
import { LeftRail, type WorkspaceMode } from './shell';
import { tabFromElement } from './tabsModel';
import { buildPrimaryNavigationSections } from './workspaceUtils';

type PrimaryNavContextMenuState = {
  rowId: string;
  x: number;
  y: number;
};

function duplicatePlanViewCommand(
  planView: Extract<Element, { kind: 'plan_view' }>,
  elementsById: Record<string, Element>,
): Record<string, unknown> {
  const baseId = `${planView.id}-copy`;
  let id = baseId;
  let suffix = 2;
  while (elementsById[id]) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const cmd: Record<string, unknown> = {
    type: 'upsertPlanView',
    id,
    name: `${planView.name} (copy)`,
    levelId: planView.levelId,
    planPresentation: planView.planPresentation ?? 'default',
    discipline: planView.discipline ?? 'architecture',
  };
  if (planView.viewTemplateId) cmd.viewTemplateId = planView.viewTemplateId;
  if (planView.planDetailLevel) cmd.planDetailLevel = planView.planDetailLevel;
  if (planView.planRoomFillOpacityScale != null) {
    cmd.planRoomFillOpacityScale = planView.planRoomFillOpacityScale;
  }
  if (planView.planShowOpeningTags !== undefined) {
    cmd.planShowOpeningTags = planView.planShowOpeningTags;
  }
  if (planView.planShowRoomLabels !== undefined) {
    cmd.planShowRoomLabels = planView.planShowRoomLabels;
  }
  if (planView.planOpeningTagStyleId) cmd.planOpeningTagStyleId = planView.planOpeningTagStyleId;
  if (planView.planRoomTagStyleId) cmd.planRoomTagStyleId = planView.planRoomTagStyleId;
  if (planView.viewSubdiscipline) cmd.viewSubdiscipline = planView.viewSubdiscipline;
  if (planView.planViewSubtype) cmd.planViewSubtype = planView.planViewSubtype;
  if (planView.areaScheme) cmd.areaScheme = planView.areaScheme;
  if (planView.underlayLevelId) cmd.underlayLevelId = planView.underlayLevelId;
  if (planView.phaseId) cmd.phaseId = planView.phaseId;
  if (planView.categoriesHidden?.length) cmd.categoriesHidden = [...planView.categoriesHidden];
  if (planView.cropMinMm) cmd.cropMinMm = planView.cropMinMm;
  if (planView.cropMaxMm) cmd.cropMaxMm = planView.cropMaxMm;
  if (planView.viewRangeBottomMm != null) cmd.viewRangeBottomMm = planView.viewRangeBottomMm;
  if (planView.viewRangeTopMm != null) cmd.viewRangeTopMm = planView.viewRangeTopMm;
  if (planView.cutPlaneOffsetMm != null) cmd.cutPlaneOffsetMm = planView.cutPlaneOffsetMm;
  return cmd;
}

function elementDisplayName(element: Element | undefined): string | undefined {
  if (!element || !('name' in element) || typeof element.name !== 'string') return undefined;
  return element.name;
}

export function WorkspaceLeftRail({
  projectName,
  projectNameRef,
  onProjectNameClick,
  openTabFromElement,
  onSetModeOnly,
  onSemanticCommand,
  onCreateFloorPlan,
  onCreate3dView,
  onCreateSectionView,
  onCreateSheet,
  onCreateSchedule,
  onOpenProjectSettings,
  onOpenSavedView,
  onViewDragStart,
  onViewDragEnd,
  activeViewTargetId,
  userDisplayName,
  userId,
  modelId,
  revision,
}: {
  projectName?: string;
  projectNameRef?: RefObject<HTMLButtonElement | null>;
  onProjectNameClick?: () => void;
  openTabFromElement: (el: Element) => void;
  /** Sets mode + viewerMode without touching tab state. Used after
   * `openTabFromElement` has already activated the correct tab, so that
   * `onModeChange` (which calls activateOrOpenKind) doesn't override it. */
  onSetModeOnly?: (mode: WorkspaceMode) => void;
  onSemanticCommand?: (cmd: Record<string, unknown>) => void | Promise<void>;
  onCreateFloorPlan?: () => void;
  onCreate3dView?: () => void;
  onCreateSectionView?: () => void;
  onCreateSheet?: () => void;
  onCreateSchedule?: () => void;
  onOpenProjectSettings?: () => void;
  onOpenSavedView?: (savedViewId: string) => void;
  onViewDragStart?: (elementId: string) => void;
  onViewDragEnd?: () => void;
  activeViewTargetId?: string | null;
  userDisplayName?: string;
  userId?: string | null;
  modelId?: string | null;
  revision?: number | null;
}): JSX.Element {
  const elementsById = useBimStore((s) => s.elementsById);
  const activatePlanView = useBimStore((s) => s.activatePlanView);
  const activePlanViewId = useBimStore((s) => s.activePlanViewId);
  const activeViewpointId = useBimStore((s) => s.activeViewpointId);
  const selectedId = useBimStore((s) => s.selectedId);
  const select = useBimStore((s) => s.select);
  const setOrbitCameraFromViewpointMm = useBimStore((s) => s.setOrbitCameraFromViewpointMm);
  const setActiveViewpointId = useBimStore((s) => s.setActiveViewpointId);
  const [contextMenu, setContextMenu] = useState<PrimaryNavContextMenuState | null>(null);

  const browserSections = useMemo(
    () => buildPrimaryNavigationSections(elementsById),
    [elementsById],
  );
  const primarySections = useMemo(
    () =>
      browserSections.map((section) => {
        if (section.id === 'floor-plans') {
          return {
            ...section,
            headerAction: {
              label: 'New floor plan',
              testId: 'primary-create-floor-plan',
              onClick: onCreateFloorPlan,
            },
          };
        }
        if (section.id === '3d-views') {
          return {
            ...section,
            headerAction: {
              label: 'New 3D view',
              testId: 'primary-create-3d-view',
              onClick: onCreate3dView,
            },
          };
        }
        if (section.id === 'sections') {
          return {
            ...section,
            headerAction: {
              label: 'New section',
              testId: 'primary-create-section',
              onClick: onCreateSectionView,
            },
          };
        }
        if (section.id === 'sheets') {
          return {
            ...section,
            headerAction: {
              label: 'New sheet',
              testId: 'primary-create-sheet',
              onClick: onCreateSheet,
            },
          };
        }
        if (section.id === 'schedules') {
          return {
            ...section,
            headerAction: {
              label: 'New schedule',
              testId: 'primary-create-schedule',
              onClick: onCreateSchedule,
            },
          };
        }
        return section;
      }),
    [
      browserSections,
      onCreate3dView,
      onCreateFloorPlan,
      onCreateSchedule,
      onCreateSectionView,
      onCreateSheet,
    ],
  );
  const initials = (userDisplayName || userId || 'User').slice(0, 2).toUpperCase();
  const accountStatus = modelId ? `Model ${modelId} · Rev ${revision ?? 0}` : 'No model loaded';

  const activateRow = useCallback(
    (id: string) => {
      const el = elementsById[id];
      if (!el) return;
      if (el.kind === 'plan_view') {
        activatePlanView(id);
        openTabFromElement(el);
        onSetModeOnly?.('plan'); // change mode without overriding the active tab
        select(undefined);
        return;
      }
      if (el.kind === 'viewpoint') {
        openTabFromElement(el);
        onSetModeOnly?.('3d'); // change mode without overriding the active tab
        select(undefined);
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
        select(undefined);
        return;
      }
      if (el.kind === 'saved_view') {
        onOpenSavedView?.(el.id);
        return;
      }
      if (el.kind === 'sheet') {
        openTabFromElement(el);
        onSetModeOnly?.('sheet'); // change mode without overriding the active tab
        select(undefined);
        return;
      }
      if (el.kind === 'schedule') {
        openTabFromElement(el);
        onSetModeOnly?.('schedule'); // change mode without overriding the active tab
        select(undefined);
        return;
      }
      if (el.kind === 'project_settings') {
        select(el.id);
        onOpenProjectSettings?.();
      }
    },
    [
      activatePlanView,
      elementsById,
      onSetModeOnly,
      onOpenProjectSettings,
      onOpenSavedView,
      openTabFromElement,
      selectedId,
      select,
      setActiveViewpointId,
      setOrbitCameraFromViewpointMm,
    ],
  );

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [contextMenu]);

  const contextElement = contextMenu ? elementsById[contextMenu.rowId] : undefined;
  const contextElementName = elementDisplayName(contextElement);
  const canEditContextElement = !!contextElementName;
  const canDuplicateContextElement = contextElement?.kind === 'plan_view';

  const renameElement = useCallback(
    (elementId: string, nextName: string) => {
      const element = elementsById[elementId];
      const previousName = elementDisplayName(element);
      const trimmed = nextName.trim();
      if (!previousName || !trimmed || trimmed === previousName || !onSemanticCommand) return;
      void onSemanticCommand({
        type: 'updateElementProperty',
        elementId,
        key: 'name',
        value: trimmed,
      });
    },
    [elementsById, onSemanticCommand],
  );

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
      <div className="min-h-0 flex-1 overflow-y-auto">
        <LeftRail
          sections={primarySections}
          activeRowId={activeViewTargetId ?? activePlanViewId ?? activeViewpointId ?? selectedId}
          onRowActivate={activateRow}
          onRowContextMenu={(rowId, position) => {
            if (!elementsById[rowId]) return;
            setContextMenu({ rowId, x: position.x, y: position.y });
          }}
          onRowRename={renameElement}
          getRowDragData={(rowId) => {
            const el = elementsById[rowId];
            if (!el || !tabFromElement(el)) return null;
            return {
              'application/x-bim-element-id': rowId,
              'text/plain': rowId,
            };
          }}
          onRowDragStart={onViewDragStart}
          onRowDragEnd={onViewDragEnd}
        />
      </div>
      {contextMenu && contextElement ? (
        <div
          role="menu"
          aria-label={`Navigation actions for ${contextElementName ?? contextElement.id}`}
          data-testid="primary-nav-context-menu"
          className="fixed z-50 min-w-40 rounded border border-border bg-surface py-1 text-xs text-foreground shadow-lg"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            data-testid="primary-nav-context-open"
            className="block w-full px-3 py-1.5 text-left hover:bg-surface-strong"
            onClick={() => {
              activateRow(contextElement.id);
              setContextMenu(null);
            }}
          >
            Open
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="primary-nav-context-rename"
            disabled={!canEditContextElement || !onSemanticCommand}
            className="block w-full px-3 py-1.5 text-left hover:bg-surface-strong disabled:text-muted disabled:hover:bg-transparent"
            onClick={() => {
              if (!canEditContextElement || !onSemanticCommand) return;
              const nextName = window.prompt('Rename view', contextElementName);
              const trimmed = nextName?.trim();
              if (trimmed && trimmed !== contextElementName) {
                void onSemanticCommand({
                  type: 'updateElementProperty',
                  elementId: contextElement.id,
                  key: 'name',
                  value: trimmed,
                });
              }
              setContextMenu(null);
            }}
          >
            Rename
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="primary-nav-context-duplicate"
            disabled={!canDuplicateContextElement || !onSemanticCommand}
            title={
              canDuplicateContextElement
                ? 'Duplicate this plan view'
                : 'Duplicate is available for plan views in this shell slice'
            }
            className="block w-full px-3 py-1.5 text-left hover:bg-surface-strong disabled:text-muted disabled:hover:bg-transparent"
            onClick={() => {
              if (contextElement?.kind !== 'plan_view' || !onSemanticCommand) return;
              void onSemanticCommand(duplicatePlanViewCommand(contextElement, elementsById));
              setContextMenu(null);
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            data-testid="primary-nav-context-delete"
            disabled={!canEditContextElement || !onSemanticCommand}
            className="block w-full px-3 py-1.5 text-left text-danger hover:bg-surface-strong disabled:text-muted disabled:hover:bg-transparent"
            onClick={() => {
              if (!canEditContextElement || !onSemanticCommand) return;
              if (window.confirm(`Delete ${contextElementName}?`)) {
                void onSemanticCommand({ type: 'deleteElement', elementId: contextElement.id });
              }
              setContextMenu(null);
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
      <div className="shrink-0 border-t border-border p-2">
        <details
          data-testid="primary-user-menu"
          className="group rounded border border-border bg-surface text-xs text-foreground"
        >
          <summary
            aria-label="Account menu"
            className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 hover:bg-surface-strong [&::-webkit-details-marker]:hidden"
          >
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background"
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{userDisplayName || 'User'}</span>
              <span className="block truncate text-[11px] text-muted">{accountStatus}</span>
            </span>
            <Icons.disclosureOpen
              size={12}
              className="shrink-0 text-muted transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="border-t border-border py-1" role="menu" aria-label="Account actions">
            <button
              type="button"
              role="menuitem"
              className="block w-full px-2 py-1 text-left text-[11px] text-foreground/80 hover:bg-surface-strong"
            >
              Profile settings
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-2 py-1 text-left text-[11px] text-foreground/80 hover:bg-surface-strong"
            >
              License status
            </button>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-2 py-1 text-left text-[11px] text-foreground/80 hover:bg-surface-strong"
            >
              Sign out
            </button>
          </div>
        </details>
      </div>
    </div>
  );
}
