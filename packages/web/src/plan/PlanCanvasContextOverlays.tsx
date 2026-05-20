import type { Element } from '@bim-ai/core';

import type { CategoryOverride } from '../state/storeTypes';
import { ElementContextMenu } from '../workspace/ElementContextMenu';
import { contextMenuItemsForElement } from '../workspace/contextMenuItems';
import {
  WallContextMenu,
  type WallContextMenuCommand,
} from '../workspace/viewport/WallContextMenu';
import { CanvasContextMenu } from './CanvasContextMenu';
import {
  dxfViewOverrideKey,
  hiddenDxfLayerNamesForView,
  setDxfLayerHiddenInView,
  type DxfPrimitiveQueryHit,
} from './dxfUnderlay';

type Position = {
  x: number;
  y: number;
};

export type PlanCanvasWallContextMenuState = {
  wall: Extract<Element, { kind: 'wall' }>;
  position: Position;
};

export type PlanCanvasUnhideContextMenuState = {
  elementKind: string;
  elementId?: string;
  position: Position;
};

export type PlanCanvasWallJoinContextMenuState = {
  wallId: string;
  endpoint: 'start' | 'end';
  position: Position;
  currentlyDisallowed: boolean;
};

export type PlanCanvasElementContextMenuState = {
  el: Element;
  position: Position;
};

export type PlanCanvasDxfQueryDialogState = {
  hit: DxfPrimitiveQueryHit;
  position: Position;
};

type Props = {
  wallContextMenu: PlanCanvasWallContextMenuState | null;
  onWallContextCommand: (next: WallContextMenuCommand) => void;
  onCloseWallContextMenu: () => void;
  canvasContextMenu: Position | null;
  onCloseCanvasContextMenu: () => void;
  onCanvasZoomIn: () => void;
  onCanvasZoomOut: () => void;
  onCanvasZoomFit: () => void;
  elementContextMenu: PlanCanvasElementContextMenuState | null;
  activeLevelId: string;
  planTool: string;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  onCloseElementContextMenu: () => void;
  unhideContextMenu: PlanCanvasUnhideContextMenuState | null;
  activePlanViewId?: string | null;
  onSetCategoryOverride: (
    planViewId: string,
    categoryKey: string,
    override: CategoryOverride,
  ) => void;
  onCloseUnhideContextMenu: () => void;
  dxfQueryHover: DxfPrimitiveQueryHit | null;
  dxfQueryDialog: PlanCanvasDxfQueryDialogState | null;
  elementsById: Record<string, Element | undefined>;
  onCloseDxfQueryDialog: () => void;
  onUpdateDxfQueryDialog: (next: PlanCanvasDxfQueryDialogState) => void;
  wallJoinContextMenu: PlanCanvasWallJoinContextMenuState | null;
  onCloseWallJoinContextMenu: () => void;
};

function UnhideContextMenu({
  unhideContextMenu,
  activePlanViewId,
  onSemanticCommand,
  onSetCategoryOverride,
  onCloseUnhideContextMenu,
}: Pick<
  Props,
  | 'unhideContextMenu'
  | 'activePlanViewId'
  | 'onSemanticCommand'
  | 'onSetCategoryOverride'
  | 'onCloseUnhideContextMenu'
>) {
  if (!unhideContextMenu) return null;

  return (
    <div
      data-testid="unhide-context-menu"
      className="pointer-events-auto absolute z-50 flex flex-col overflow-hidden rounded border border-border bg-surface shadow-md"
      style={{ left: unhideContextMenu.position.x, top: unhideContextMenu.position.y }}
    >
      {unhideContextMenu.elementId ? (
        <button
          type="button"
          className="px-3 py-1.5 text-left text-xs hover:bg-surface-strong"
          data-testid="unhide-context-element"
          onClick={() => {
            if (activePlanViewId && unhideContextMenu.elementId) {
              void onSemanticCommand({
                type: 'unhideElementInView',
                planViewId: activePlanViewId,
                elementId: unhideContextMenu.elementId,
              });
            }
            onCloseUnhideContextMenu();
          }}
        >
          Unhide Element
        </button>
      ) : null}
      <button
        type="button"
        className="px-3 py-1.5 text-left text-xs hover:bg-surface-strong"
        data-testid="unhide-context-category"
        onClick={() => {
          if (activePlanViewId) {
            onSetCategoryOverride(activePlanViewId, unhideContextMenu.elementKind, {
              visible: true,
            });
          }
          onCloseUnhideContextMenu();
        }}
      >
        Unhide in View: {unhideContextMenu.elementKind}
      </button>
    </div>
  );
}

function DxfQueryOverlays({
  dxfQueryHover,
  dxfQueryDialog,
  activePlanViewId,
  elementsById,
  onSetCategoryOverride,
  onCloseDxfQueryDialog,
  onUpdateDxfQueryDialog,
}: Pick<
  Props,
  | 'dxfQueryHover'
  | 'dxfQueryDialog'
  | 'activePlanViewId'
  | 'elementsById'
  | 'onSetCategoryOverride'
  | 'onCloseDxfQueryDialog'
  | 'onUpdateDxfQueryDialog'
>) {
  return (
    <>
      {dxfQueryHover ? (
        <div
          data-testid="dxf-query-hover"
          className="pointer-events-none absolute left-3 top-3 z-40 rounded border border-border bg-surface px-2 py-1 text-[11px] shadow-sm"
        >
          {dxfQueryHover.link.name ?? 'DXF Underlay'} / {dxfQueryHover.layerName}
        </div>
      ) : null}
      {dxfQueryDialog ? (
        <div
          data-testid="dxf-query-dialog"
          className="pointer-events-auto absolute z-50 w-64 rounded border border-border bg-surface p-3 text-xs shadow-md"
          style={{ left: dxfQueryDialog.position.x, top: dxfQueryDialog.position.y }}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-medium">Imported CAD Query</div>
              <div className="truncate text-[11px] text-muted">
                {dxfQueryDialog.hit.link.name ?? 'DXF Underlay'}
              </div>
            </div>
            <button
              type="button"
              aria-label="Close imported CAD query"
              className="rounded border border-border px-1.5 py-0.5 text-[11px] hover:bg-surface-strong"
              onClick={onCloseDxfQueryDialog}
            >
              Close
            </button>
          </div>
          <dl className="grid grid-cols-[64px_1fr] gap-x-2 gap-y-1 text-[11px]">
            <dt className="text-muted">Layer</dt>
            <dd className="min-w-0 truncate" data-testid="dxf-query-layer">
              {dxfQueryDialog.hit.layerName}
            </dd>
            <dt className="text-muted">Color</dt>
            <dd className="flex min-w-0 items-center gap-1">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm border border-border"
                style={{ backgroundColor: dxfQueryDialog.hit.color }}
              />
              <span className="truncate font-mono">{dxfQueryDialog.hit.color}</span>
            </dd>
            <dt className="text-muted">Link</dt>
            <dd className="min-w-0 truncate">{dxfQueryDialog.hit.link.id}</dd>
            <dt className="text-muted">Primitive</dt>
            <dd className="min-w-0 truncate">
              {dxfQueryDialog.hit.primitive.kind} #{dxfQueryDialog.hit.primitiveIndex + 1}
            </dd>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            {(() => {
              const hit = dxfQueryDialog.hit;
              const key = dxfViewOverrideKey(hit.link.id);
              const activePlanView = activePlanViewId ? elementsById[activePlanViewId] : undefined;
              const override =
                activePlanView?.kind === 'plan_view'
                  ? ((activePlanView.categoryOverrides ?? {}) as Record<string, CategoryOverride>)[
                      key
                    ]
                  : undefined;
              const hiddenInView = (override?.dxf?.hiddenLayerNames ?? []).includes(hit.layerName);
              const hiddenGlobally = (hit.link.hiddenLayerNames ?? []).includes(hit.layerName);
              const effectiveHidden = hiddenDxfLayerNamesForView(hit.link, override).includes(
                hit.layerName,
              );
              const canShow = hiddenInView && !hiddenGlobally;
              return (
                <>
                  <button
                    type="button"
                    disabled={!activePlanViewId || effectiveHidden}
                    data-testid="dxf-query-hide-layer-view"
                    className="rounded border border-border px-2 py-1 text-[11px] hover:bg-surface-strong disabled:opacity-50"
                    onClick={() => {
                      if (!activePlanViewId) return;
                      const next = setDxfLayerHiddenInView(override, hit.layerName, true);
                      onSetCategoryOverride(activePlanViewId, key, next);
                      onUpdateDxfQueryDialog({ ...dxfQueryDialog, hit });
                    }}
                  >
                    Hide Layer in View
                  </button>
                  <button
                    type="button"
                    disabled={!activePlanViewId || !canShow}
                    data-testid="dxf-query-show-layer-view"
                    className="rounded border border-border px-2 py-1 text-[11px] hover:bg-surface-strong disabled:opacity-50"
                    title={
                      hiddenGlobally
                        ? 'This layer is hidden globally in Manage Links'
                        : 'Show this layer in the active view'
                    }
                    onClick={() => {
                      if (!activePlanViewId) return;
                      const next = setDxfLayerHiddenInView(override, hit.layerName, false);
                      onSetCategoryOverride(activePlanViewId, key, next);
                    }}
                  >
                    Show Layer in View
                  </button>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </>
  );
}

function WallJoinContextMenu({
  wallJoinContextMenu,
  onSemanticCommand,
  onCloseWallJoinContextMenu,
}: Pick<Props, 'wallJoinContextMenu' | 'onSemanticCommand' | 'onCloseWallJoinContextMenu'>) {
  if (!wallJoinContextMenu) return null;

  return (
    <div
      data-testid="wall-join-ctx-menu"
      className="pointer-events-auto absolute z-50 flex flex-col overflow-hidden rounded border border-border bg-surface shadow-md"
      style={{ left: wallJoinContextMenu.position.x, top: wallJoinContextMenu.position.y }}
    >
      <button
        type="button"
        className="px-3 py-1.5 text-left text-xs hover:bg-surface-strong"
        data-testid="wall-join-ctx-toggle"
        onClick={() => {
          void onSemanticCommand({
            type: 'setWallJoinDisallow',
            wallId: wallJoinContextMenu.wallId,
            endpoint: wallJoinContextMenu.endpoint,
            disallow: !wallJoinContextMenu.currentlyDisallowed,
          });
          onCloseWallJoinContextMenu();
        }}
      >
        {wallJoinContextMenu.currentlyDisallowed ? 'Allow Join' : 'Disallow Join'} (
        {wallJoinContextMenu.endpoint})
      </button>
    </div>
  );
}

export function PlanCanvasContextOverlays({
  wallContextMenu,
  onWallContextCommand,
  onCloseWallContextMenu,
  canvasContextMenu,
  onCloseCanvasContextMenu,
  onCanvasZoomIn,
  onCanvasZoomOut,
  onCanvasZoomFit,
  elementContextMenu,
  activeLevelId,
  planTool,
  onSemanticCommand,
  onCloseElementContextMenu,
  unhideContextMenu,
  activePlanViewId,
  onSetCategoryOverride,
  onCloseUnhideContextMenu,
  dxfQueryHover,
  dxfQueryDialog,
  elementsById,
  onCloseDxfQueryDialog,
  onUpdateDxfQueryDialog,
  wallJoinContextMenu,
  onCloseWallJoinContextMenu,
}: Props) {
  return (
    <>
      {wallContextMenu ? (
        <WallContextMenu
          wall={wallContextMenu.wall}
          position={wallContextMenu.position}
          onCommand={onWallContextCommand}
          onClose={onCloseWallContextMenu}
        />
      ) : null}
      {canvasContextMenu ? (
        <CanvasContextMenu
          x={canvasContextMenu.x}
          y={canvasContextMenu.y}
          onClose={onCloseCanvasContextMenu}
          onZoomIn={onCanvasZoomIn}
          onZoomOut={onCanvasZoomOut}
          onZoomFit={onCanvasZoomFit}
        />
      ) : null}
      {elementContextMenu ? (
        <ElementContextMenu
          open
          anchorX={elementContextMenu.position.x}
          anchorY={elementContextMenu.position.y}
          items={contextMenuItemsForElement(
            elementContextMenu.el,
            (cmd) => void onSemanticCommand(cmd),
            { activeLevelId, planTool },
          )}
          onClose={onCloseElementContextMenu}
          data-testid="element-context-menu"
        />
      ) : null}
      <UnhideContextMenu
        unhideContextMenu={unhideContextMenu}
        activePlanViewId={activePlanViewId}
        onSemanticCommand={onSemanticCommand}
        onSetCategoryOverride={onSetCategoryOverride}
        onCloseUnhideContextMenu={onCloseUnhideContextMenu}
      />
      <DxfQueryOverlays
        dxfQueryHover={dxfQueryHover}
        dxfQueryDialog={dxfQueryDialog}
        activePlanViewId={activePlanViewId}
        elementsById={elementsById}
        onSetCategoryOverride={onSetCategoryOverride}
        onCloseDxfQueryDialog={onCloseDxfQueryDialog}
        onUpdateDxfQueryDialog={onUpdateDxfQueryDialog}
      />
      <WallJoinContextMenu
        wallJoinContextMenu={wallJoinContextMenu}
        onSemanticCommand={onSemanticCommand}
        onCloseWallJoinContextMenu={onCloseWallJoinContextMenu}
      />
    </>
  );
}
