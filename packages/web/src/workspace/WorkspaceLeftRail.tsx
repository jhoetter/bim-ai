import type { JSX, RefObject } from 'react';
import { useMemo } from 'react';

import type { Element } from '@bim-ai/core';
import { Icons } from '@bim-ai/ui';

import { useBimStore } from '../state/store';
import { LeftRail, type WorkspaceMode } from './shell';
import { buildPrimaryNavigationSections } from './workspaceUtils';

export function WorkspaceLeftRail({
  projectName,
  projectNameRef,
  onProjectNameClick,
  openTabFromElement,
  onSetModeOnly,
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
  const select = useBimStore((s) => s.select);
  const setOrbitCameraFromViewpointMm = useBimStore((s) => s.setOrbitCameraFromViewpointMm);
  const setActiveViewpointId = useBimStore((s) => s.setActiveViewpointId);

  const browserSections = useMemo(
    () => buildPrimaryNavigationSections(elementsById),
    [elementsById],
  );
  const initials = (userDisplayName || userId || 'User').slice(0, 2).toUpperCase();
  const accountStatus = modelId ? `Model ${modelId} · Rev ${revision ?? 0}` : 'No model loaded';

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
          sections={browserSections}
          activeRowId={activeViewTargetId ?? activePlanViewId ?? activeViewpointId ?? undefined}
          onRowActivate={(id) => {
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
            if (el.kind === 'view_concept_board') {
              openTabFromElement(el);
              onSetModeOnly?.('concept'); // change mode without overriding the active tab
              select(undefined);
            }
          }}
        />
      </div>
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
