import type { JSX } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Element } from '@bim-ai/core';

import { AdvisorPanel } from '../advisor/AdvisorPanel';
import { buildPlanGridDatumInspectorLine } from './readouts';
import { useBimStore } from '../state/store';
import {
  Inspector,
  InspectorConstraintsFor,
  InspectorDoorEditor,
  InspectorGraphicsFor,
  InspectorIdentityFor,
  type InspectorApplyScope,
  InspectorPlanViewEditor,
  InspectorProjectSettingsEditor,
  InspectorPropertiesFor,
  InspectorRoomEditor,
  type InspectorSelection,
  InspectorViewpointEditor,
  InspectorViewTemplateEditor,
  InspectorWindowEditor,
  SunInspectorPanel,
} from './inspector';
import type { DisciplineTag } from '@bim-ai/core';
import { AuthoringWorkbenchesPanel } from './authoring';
import { Viewport3DLayersPanel } from './viewport';
import { firstSheetId, placeViewOnSheetCommand } from './sheets/sheetRecommendedViewports';
import type { WorkspaceMode } from './shell';
import { humanKindLabel, InspectorEmptyTab } from './WorkspaceHelpers';

const NAVIGABLE_KINDS = new Set<Element['kind']>([
  'plan_view',
  'viewpoint',
  'section_cut',
  'sheet',
  'schedule',
]);

export function WorkspaceRightRail({
  mode,
  onSemanticCommand,
  onModeChange,
  codePresetIds,
  onNavigateToElement,
}: {
  mode: WorkspaceMode;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  onModeChange: (mode: WorkspaceMode) => void;
  codePresetIds: string[];
  onNavigateToElement?: (elementId: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const selectedId = useBimStore((s) => s.selectedId);
  const select = useBimStore((s) => s.select);
  const elementsById = useBimStore((s) => s.elementsById);
  const revision = useBimStore((s) => s.revision);
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const viewerCategoryHidden = useBimStore((s) => s.viewerCategoryHidden);
  const toggleViewerCategoryHidden = useBimStore((s) => s.toggleViewerCategoryHidden);
  const viewerClipElevMm = useBimStore((s) => s.viewerClipElevMm);
  const setViewerClipElevMm = useBimStore((s) => s.setViewerClipElevMm);
  const viewerClipFloorElevMm = useBimStore((s) => s.viewerClipFloorElevMm);
  const setViewerClipFloorElevMm = useBimStore((s) => s.setViewerClipFloorElevMm);
  const activeViewpointId = useBimStore((s) => s.activeViewpointId);
  const orbitCameraPoseMm = useBimStore((s) => s.orbitCameraPoseMm);
  const setOrbitCameraFromViewpointMm = useBimStore((s) => s.setOrbitCameraFromViewpointMm);
  const applyOrbitViewpointPreset = useBimStore((s) => s.applyOrbitViewpointPreset);
  const violations = useBimStore((s) => s.violations);
  const buildingPreset = useBimStore((s) => s.buildingPreset);
  const setBuildingPreset = useBimStore((s) => s.setBuildingPreset);
  const perspectiveId = useBimStore((s) => s.perspectiveId);
  const activityEvents = useBimStore((s) => s.activityEvents);
  const setPlanTool = useBimStore((s) => s.setPlanTool);
  const planProjectionPrimitives = useBimStore((s) => s.planProjectionPrimitives);
  const activePlanViewId = useBimStore((s) => s.activePlanViewId);

  const el = selectedId ? (elementsById[selectedId] as Element | undefined) : undefined;
  const activeViewpoint =
    activeViewpointId && elementsById[activeViewpointId]?.kind === 'viewpoint'
      ? (elementsById[activeViewpointId] as Extract<Element, { kind: 'viewpoint' }>)
      : undefined;
  const show3dLayers = mode === '3d' || (mode as string) === 'plan-3d';
  const showAuthoringWorkbenches =
    mode === 'plan' ||
    (mode as string) === 'plan-3d' ||
    (el ? !NAVIGABLE_KINDS.has(el.kind) : false);

  // CHR-V3-06: sibling count for the applies-to radio.
  const siblingCount = useMemo(() => {
    if (!el) return 1;
    return Object.values(elementsById).filter((e) => (e as Element).kind === el.kind).length;
  }, [el, elementsById]);

  // CHR-V3-06: non-blocking toast when "all N" scope is selected.
  const [allScopeToast, setAllScopeToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleApplyScopeChange = useCallback(
    (scope: InspectorApplyScope) => {
      if (scope === 'all' && el) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setAllScopeToast(`Edits will apply to all ${siblingCount} ${el.kind} elements.`);
        toastTimerRef.current = setTimeout(() => setAllScopeToast(null), 4000);
      } else {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setAllScopeToast(null);
      }
    },
    [el, siblingCount],
  );

  function handleDisciplineChange(discipline: DisciplineTag | null): void {
    if (!el) return;
    void onSemanticCommand({
      type: 'setElementDiscipline',
      elementIds: [el.id],
      discipline,
    });
  }

  const inspectorSelection = useMemo<InspectorSelection | null>(() => {
    if (!selectedId) return null;
    const found = elementsById[selectedId];
    if (!found) return null;
    return {
      label: `${humanKindLabel(found.kind)} · ${(found as { name?: string }).name ?? found.id}`,
      id: found.id,
    };
  }, [elementsById, selectedId]);

  const planGridDatumLine = useMemo(() => {
    if (!selectedId) return '';
    const found = elementsById[selectedId];
    if (!found || found.kind !== 'plan_view') return '';
    return buildPlanGridDatumInspectorLine(elementsById, planProjectionPrimitives, found.id);
  }, [selectedId, elementsById, planProjectionPrimitives]);

  const firstSheet = useMemo(() => firstSheetId(elementsById), [elementsById]);

  const resetActiveSavedView = useCallback(() => {
    if (!activeViewpoint || activeViewpoint.mode !== 'orbit_3d' || !activeViewpoint.camera) return;
    setOrbitCameraFromViewpointMm({
      position: activeViewpoint.camera.position,
      target: activeViewpoint.camera.target,
      up: activeViewpoint.camera.up,
    });
    applyOrbitViewpointPreset({
      capElevMm: activeViewpoint.viewerClipCapElevMm,
      floorElevMm: activeViewpoint.viewerClipFloorElevMm,
      hideSemanticKinds: activeViewpoint.hiddenSemanticKinds3d,
    });
  }, [activeViewpoint, applyOrbitViewpointPreset, setOrbitCameraFromViewpointMm]);

  const updateActiveSavedView = useCallback(() => {
    if (!activeViewpoint || activeViewpoint.mode !== 'orbit_3d') return;
    if (orbitCameraPoseMm) {
      void onSemanticCommand({
        type: 'updateElementProperty',
        elementId: activeViewpoint.id,
        key: 'camera',
        value: orbitCameraPoseMm,
      });
    }
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: activeViewpoint.id,
      key: 'viewerClipCapElevMm',
      value: viewerClipElevMm,
    });
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: activeViewpoint.id,
      key: 'viewerClipFloorElevMm',
      value: viewerClipFloorElevMm,
    });
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: activeViewpoint.id,
      key: 'hiddenSemanticKinds3d',
      value: Object.entries(viewerCategoryHidden)
        .filter(([, hidden]) => hidden)
        .map(([kind]) => kind),
    });
  }, [
    activeViewpoint,
    onSemanticCommand,
    orbitCameraPoseMm,
    viewerCategoryHidden,
    viewerClipElevMm,
    viewerClipFloorElevMm,
  ]);

  return (
    <div className="h-full overflow-y-auto">
      {/* CHR-V3-06: non-blocking scope toast */}
      {allScopeToast ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: '1rem',
            right: '1rem',
            zIndex: 50,
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: 'var(--text-sm)',
            backgroundColor: 'var(--color-surface-strong)',
            boxShadow: 'var(--shadow-modal)',
            animation: 'slide-up 200ms var(--ease-paper) both',
          }}
        >
          {allScopeToast}
        </div>
      ) : null}
      {/* VIS-V3-04: Scene section — visible when no element is selected */}
      {!selectedId ? (
        <div className="border-b border-border p-3">
          <div
            className="mb-2 text-[10px] font-semibold uppercase text-muted"
            style={{ letterSpacing: '0.08em', opacity: 0.7 }}
          >
            Scene
          </div>
          <SunInspectorPanel />
          {activePlanViewId && elementsById[activePlanViewId]?.kind === 'plan_view' ? (
            <div className="mt-3 border-t border-border pt-3">
              <div
                className="mb-2 text-[10px] font-semibold uppercase text-muted"
                style={{ letterSpacing: '0.08em', opacity: 0.7 }}
              >
                Active View
              </div>
              <InspectorPlanViewEditor
                el={elementsById[activePlanViewId] as Extract<Element, { kind: 'plan_view' }>}
                elementsById={elementsById}
                revision={revision}
                onPersistProperty={(key, value) => {
                  if (key === '__applyTemplate__') {
                    const p = JSON.parse(value) as { planViewId: string; templateId: string };
                    void onSemanticCommand({ type: 'applyPlanViewTemplate', ...p });
                  } else if (key === '__saveAsTemplate__') {
                    const p = JSON.parse(value) as {
                      name: string;
                      detailLevel: string | null;
                      phaseFilter: string | null;
                    };
                    const templateId = `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                    void onSemanticCommand({
                      type: 'CreateViewTemplate',
                      templateId,
                      name: p.name,
                      detailLevel: p.detailLevel ?? undefined,
                      phaseFilter: p.phaseFilter ?? undefined,
                    });
                  } else {
                    void onSemanticCommand({
                      type: 'updateElementProperty',
                      elementId: activePlanViewId,
                      key,
                      value,
                    });
                  }
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      {/* CHR-V3-06: key={selectedId} remounts (and re-animates) Inspector on each selection */}
      <div style={{ position: 'relative' }}>
        <Inspector
          key={selectedId ?? 'none'}
          selection={inspectorSelection}
          siblingCount={siblingCount}
          onApplyScopeChange={handleApplyScopeChange}
          tabs={{
            properties: el ? (
              <>
                <InspectorContextActions
                  element={el}
                  firstSheetId={firstSheet}
                  onNavigateToElement={onNavigateToElement}
                  onPlaceRecommendedViews={(sheetId) => {
                    const cmd = placeViewOnSheetCommand(elementsById, sheetId, el.id);
                    if (cmd) void onSemanticCommand(cmd);
                  }}
                  onDuplicatePlanView={(planView) => {
                    void onSemanticCommand({
                      type: 'upsertPlanView',
                      id: `pv-${crypto.randomUUID()}`,
                      name: `${planView.name} copy`,
                      levelId: planView.levelId,
                      discipline: planView.discipline,
                      viewTemplateId: planView.viewTemplateId,
                      cropMinMm: planView.cropMinMm,
                      cropMaxMm: planView.cropMaxMm,
                    });
                  }}
                  onResetSavedView={resetActiveSavedView}
                  onUpdateSavedView={updateActiveSavedView}
                />
                {el.kind === 'plan_view' ? (
                  <>
                    {planGridDatumLine ? (
                      <p className="mb-2 break-all font-mono text-[10px] leading-snug text-muted">
                        {planGridDatumLine}
                      </p>
                    ) : null}
                    <InspectorPlanViewEditor
                      el={el}
                      elementsById={elementsById}
                      revision={revision}
                      onPersistProperty={(key, value) => {
                        if (key === '__applyTemplate__') {
                          const p = JSON.parse(value) as {
                            planViewId: string;
                            templateId: string;
                          };
                          void onSemanticCommand({ type: 'applyPlanViewTemplate', ...p });
                        } else if (key === '__saveAsTemplate__') {
                          const p = JSON.parse(value) as {
                            name: string;
                            detailLevel: string | null;
                            phaseFilter: string | null;
                          };
                          const templateId = `tmpl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                          void onSemanticCommand({
                            type: 'CreateViewTemplate',
                            templateId,
                            name: p.name,
                            detailLevel: p.detailLevel ?? undefined,
                            phaseFilter: p.phaseFilter ?? undefined,
                          });
                        } else {
                          void onSemanticCommand({
                            type: 'updateElementProperty',
                            elementId: el.id,
                            key,
                            value,
                          });
                        }
                      }}
                    />
                  </>
                ) : el.kind === 'room' ? (
                  <InspectorRoomEditor
                    el={el}
                    revision={revision}
                    onPersistProperty={(key, value) =>
                      void onSemanticCommand({
                        type: 'updateElementProperty',
                        elementId: el.id,
                        key,
                        value,
                      })
                    }
                  />
                ) : el.kind === 'viewpoint' ? (
                  <InspectorViewpointEditor
                    el={el}
                    revision={revision}
                    onPersistProperty={(key, value) =>
                      void onSemanticCommand({
                        type: 'updateElementProperty',
                        elementId: el.id,
                        key,
                        value,
                      })
                    }
                  />
                ) : el.kind === 'view_template' ? (
                  <InspectorViewTemplateEditor
                    el={el}
                    elementsById={elementsById}
                    revision={revision}
                    onPersistProperty={(key, value) => {
                      if (key === '__updateViewTemplate__') {
                        const patch = JSON.parse(value) as {
                          scale?: number | null;
                          detailLevel?: string | null;
                          phase?: string | null;
                          phaseFilter?: string | null;
                        };
                        void onSemanticCommand({
                          type: 'UpdateViewTemplate',
                          templateId: el.id,
                          ...patch,
                        });
                      } else {
                        void onSemanticCommand({
                          type: 'updateElementProperty',
                          elementId: el.id,
                          key,
                          value,
                        });
                      }
                    }}
                  />
                ) : el.kind === 'door' ? (
                  <InspectorDoorEditor
                    el={el}
                    revision={revision}
                    elementsById={elementsById}
                    onPersistProperty={(key, value) =>
                      void onSemanticCommand({
                        type: 'updateElementProperty',
                        elementId: el.id,
                        key,
                        value,
                      })
                    }
                    onCreateType={(_baseFamilyId, _name, params) =>
                      void onSemanticCommand({
                        type: 'upsertFamilyType',
                        discipline: 'door',
                        parameters: params,
                      })
                    }
                    onDisciplineChange={handleDisciplineChange}
                  />
                ) : el.kind === 'window' ? (
                  <InspectorWindowEditor
                    el={el}
                    revision={revision}
                    elementsById={elementsById}
                    onPersistProperty={(key, value) =>
                      void onSemanticCommand({
                        type: 'updateElementProperty',
                        elementId: el.id,
                        key,
                        value,
                      })
                    }
                    onCreateType={(_baseFamilyId, _name, params) =>
                      void onSemanticCommand({
                        type: 'upsertFamilyType',
                        discipline: 'window',
                        parameters: params,
                      })
                    }
                    onDisciplineChange={handleDisciplineChange}
                  />
                ) : el.kind === 'project_settings' ? (
                  <InspectorProjectSettingsEditor
                    el={el}
                    onPersistProperty={(key, value) =>
                      void onSemanticCommand({
                        type: 'updateElementProperty',
                        elementId: el.id,
                        key,
                        value,
                      })
                    }
                  />
                ) : el.kind === 'wall' ? (
                  <>
                    {InspectorPropertiesFor(el, t, {
                      elementsById,
                      onPropertyChange: (property, value) =>
                        void onSemanticCommand({
                          type: 'updateElementProperty',
                          elementId: el.id,
                          key: property,
                          value,
                        }),
                      onDisciplineChange: handleDisciplineChange,
                      onEditType: (typeId) => select(typeId),
                    })}
                    <WallJoinDisallowSection
                      wall={el}
                      onToggle={(endpoint, disallow) =>
                        void onSemanticCommand({
                          type: 'setWallJoinDisallow',
                          wallId: el.id,
                          endpoint,
                          disallow,
                        })
                      }
                    />
                    <WallMoveSection
                      onMove={(dx, dy) =>
                        void onSemanticCommand({
                          type: 'moveWallDelta',
                          wallId: el.id,
                          dxMm: dx,
                          dyMm: dy,
                        })
                      }
                    />
                  </>
                ) : el.kind === 'project_base_point' || el.kind === 'survey_point' ? (
                  <CoordinatePointInspector
                    key={el.id}
                    el={el as Extract<Element, { kind: 'project_base_point' | 'survey_point' }>}
                    onSemanticCommand={onSemanticCommand}
                  />
                ) : el.kind === 'placed_asset' ? (
                  <PlacedAssetInspector
                    el={el as Extract<Element, { kind: 'placed_asset' }>}
                    onSemanticCommand={onSemanticCommand}
                  />
                ) : el.kind === 'column' ? (
                  <ColumnInspector
                    el={el as Extract<Element, { kind: 'column' }>}
                    onSemanticCommand={onSemanticCommand}
                    t={t}
                  />
                ) : (
                  InspectorPropertiesFor(el, t, {
                    elementsById,
                    onPropertyChange: (property, value) =>
                      void onSemanticCommand({
                        type: 'updateElementProperty',
                        elementId: el.id,
                        key: property,
                        value,
                      }),
                    onDisciplineChange: handleDisciplineChange,
                    onEditType: (typeId) => select(typeId),
                  })
                )}
                {activePlanViewId && (
                  <div
                    style={{
                      borderTop: '1px solid var(--color-border)',
                      paddingTop: 6,
                      marginTop: 8,
                      display: 'flex',
                      gap: 4,
                      flexWrap: 'wrap',
                    }}
                  >
                    <button
                      data-testid="inspector-hide-element"
                      type="button"
                      onClick={() => {
                        void onSemanticCommand({
                          type: 'hideElementInView',
                          planViewId: activePlanViewId,
                          elementId: el.id,
                        });
                      }}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        color: 'var(--color-muted)',
                      }}
                      title={`Hide this element in the active plan view`}
                    >
                      Hide Element in View
                    </button>
                    <button
                      data-testid="inspector-hide-category"
                      type="button"
                      onClick={() => {
                        useBimStore
                          .getState()
                          .setCategoryOverride(activePlanViewId, el.kind, { visible: false });
                      }}
                      style={{
                        fontSize: 11,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        color: 'var(--color-muted)',
                      }}
                      title={`Hide all ${el.kind} elements in this view`}
                    >
                      Hide Category in View
                    </button>
                  </div>
                )}
              </>
            ) : (
              <InspectorEmptyTab message="No element selected." />
            ),
            constraints: el ? (
              InspectorConstraintsFor(el, t)
            ) : (
              <InspectorEmptyTab message="No element selected." />
            ),
            identity: el ? (
              InspectorIdentityFor(el, t)
            ) : (
              <InspectorEmptyTab message="No element selected." />
            ),
            graphics:
              el && (el.kind === 'plan_view' || el.kind === 'view_template') ? (
                <InspectorGraphicsFor
                  el={el}
                  elementsById={elementsById}
                  revision={revision}
                  onPersistProperty={(key, value) =>
                    void onSemanticCommand({
                      type: 'updateElementProperty',
                      elementId: el.id,
                      key,
                      value,
                    })
                  }
                />
              ) : undefined,
            evidence: el ? (
              <InspectorEvidenceFor element={el} elementsById={elementsById} />
            ) : (
              <InspectorEmptyTab message="No evidence context." />
            ),
          }}
          emptyStateActions={[
            {
              hotkey: 'W',
              label: 'Draw a wall',
              onTrigger: () => {
                if (mode !== 'plan' && (mode as string) !== 'plan-3d') onModeChange('plan');
                setPlanTool('wall');
              },
            },
            {
              hotkey: 'D',
              label: 'Insert a door',
              onTrigger: () => {
                if (mode !== 'plan' && (mode as string) !== 'plan-3d') onModeChange('plan');
                setPlanTool('door');
              },
            },
            {
              hotkey: 'M',
              label: 'Drop a room marker',
              onTrigger: () => {
                if (mode !== 'plan' && (mode as string) !== 'plan-3d') onModeChange('plan');
                setPlanTool('room');
              },
            },
          ]}
          onClearSelection={() => useBimStore.getState().select(undefined)}
        />
      </div>
      {show3dLayers ? (
        <div className="border-t border-border">
          <Viewport3DLayersPanel
            viewerCategoryHidden={viewerCategoryHidden}
            onToggleCategory={toggleViewerCategoryHidden}
            viewerClipElevMm={viewerClipElevMm}
            onSetClipElevMm={setViewerClipElevMm}
            viewerClipFloorElevMm={viewerClipFloorElevMm}
            onSetClipFloorElevMm={setViewerClipFloorElevMm}
            activeViewpointId={activeViewpointId ?? undefined}
            onResetToSavedView={activeViewpoint ? resetActiveSavedView : undefined}
            onUpdateSavedView={activeViewpoint ? updateActiveSavedView : undefined}
          />
        </div>
      ) : null}
      {showAuthoringWorkbenches ? (
        <div className="border-t border-border">
          <AuthoringWorkbenchesPanel
            selected={el}
            elementsById={elementsById}
            activeLevelId={activeLevelId ?? ''}
            onUpsertSemantic={(cmd) => void onSemanticCommand(cmd)}
          />
        </div>
      ) : null}
      <div className="border-t border-border p-3">
        <div
          className="mb-2 text-[10px] font-semibold uppercase text-muted"
          style={{ letterSpacing: '0.08em', opacity: 0.7 }}
        >
          {t('advisor.heading')}
        </div>
        <AdvisorPanel
          violations={violations}
          selectionId={selectedId ?? undefined}
          preset={buildingPreset}
          onPreset={setBuildingPreset}
          codePresets={codePresetIds}
          onApplyQuickFix={(cmd) => void onSemanticCommand(cmd)}
          perspective={perspectiveId}
        />
      </div>
      {activityEvents.length > 0 ? (
        <div className="border-t border-border p-3">
          <div
            className="mb-2 text-[10px] font-semibold uppercase text-muted"
            style={{ letterSpacing: '0.08em', opacity: 0.7 }}
          >
            {t('activity.heading')}
          </div>
          <ul className="space-y-1 text-[11px] text-muted">
            {activityEvents.map((a) => (
              <li key={a.id}>
                r{a.revisionAfter} · {a.commandTypes[0] ?? '?'}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function InspectorContextActions({
  element,
  firstSheetId,
  onNavigateToElement,
  onPlaceRecommendedViews,
  onDuplicatePlanView,
  onResetSavedView,
  onUpdateSavedView,
}: {
  element: Element;
  firstSheetId: string | null;
  onNavigateToElement?: (elementId: string) => void;
  onPlaceRecommendedViews: (sheetId: string) => void;
  onDuplicatePlanView: (planView: Extract<Element, { kind: 'plan_view' }>) => void;
  onResetSavedView: () => void;
  onUpdateSavedView: () => void;
}): JSX.Element | null {
  const buttons: JSX.Element[] = [];

  if (onNavigateToElement && NAVIGABLE_KINDS.has(element.kind)) {
    buttons.push(
      <button
        key="open"
        data-testid="inspector-navigate-to-view"
        type="button"
        onClick={() => onNavigateToElement(element.id)}
        className="rounded border border-accent bg-accent/15 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent/20"
      >
        Open in Canvas
      </button>,
    );
  }

  if (element.kind === 'plan_view') {
    buttons.push(
      <button
        key="duplicate"
        type="button"
        className="rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:bg-surface"
        onClick={() => onDuplicatePlanView(element)}
      >
        Duplicate view
      </button>,
    );
  }

  if (
    firstSheetId &&
    (element.kind === 'plan_view' ||
      element.kind === 'section_cut' ||
      element.kind === 'schedule' ||
      element.kind === 'viewpoint')
  ) {
    buttons.push(
      <button
        key="place"
        type="button"
        className="rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:bg-surface"
        onClick={() => onPlaceRecommendedViews(firstSheetId)}
      >
        Place on sheet
      </button>,
    );
  }

  if (element.kind === 'viewpoint' && element.mode === 'orbit_3d') {
    buttons.push(
      <button
        key="reset"
        type="button"
        className="rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:bg-surface"
        onClick={onResetSavedView}
      >
        Reset to saved camera
      </button>,
      <button
        key="update"
        type="button"
        className="rounded border border-accent bg-accent/15 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent/20"
        onClick={onUpdateSavedView}
      >
        Update saved view
      </button>,
    );
  }

  if (buttons.length === 0) return null;
  return (
    <div className="mb-3 rounded border border-border bg-surface-strong p-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
        Actions
      </div>
      <div className="flex flex-wrap gap-1.5">{buttons}</div>
    </div>
  );
}

function InspectorEvidenceFor({
  element,
  elementsById,
}: {
  element: Element;
  elementsById: Record<string, Element>;
}): JSX.Element {
  const displayName = (element as { name?: string }).name ?? element.id;
  const parent =
    'levelId' in element && typeof element.levelId === 'string'
      ? elementsById[element.levelId]
      : undefined;
  const architectRows = [
    ['Type', humanKindLabel(element.kind)],
    ['Name', displayName],
    parent && parent.kind === 'level' ? ['Level datum', parent.name] : null,
  ].filter((row): row is string[] => Array.isArray(row));
  return (
    <div className="space-y-3 text-[11px]">
      <div className="rounded border border-border bg-surface-strong p-2">
        <div className="font-medium text-foreground">Professional context</div>
        <dl className="mt-2 space-y-1">
          {architectRows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted">{k}</dt>
              <dd className="text-right text-foreground">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <details className="rounded border border-border bg-background p-2">
        <summary className="cursor-pointer font-medium text-muted">Raw provenance</summary>
        <dl className="mt-2 space-y-1 font-mono text-[10px] text-muted">
          <div>
            <dt className="inline">id: </dt>
            <dd className="inline break-all">{element.id}</dd>
          </div>
          <div>
            <dt className="inline">kind: </dt>
            <dd className="inline">{element.kind}</dd>
          </div>
          {'evidenceRefs' in element &&
          Array.isArray((element as { evidenceRefs?: unknown }).evidenceRefs) ? (
            <div>
              <dt className="inline">evidenceRefs: </dt>
              <dd className="inline break-all">
                {((element as { evidenceRefs?: unknown[] }).evidenceRefs ?? [])
                  .map((ref) => String(ref))
                  .join(', ')}
              </dd>
            </div>
          ) : null}
        </dl>
      </details>
    </div>
  );
}

function PlacedAssetInspector({
  el,
  onSemanticCommand,
}: {
  el: Extract<Element, { kind: 'placed_asset' }>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): JSX.Element {
  const dxRef = useRef<HTMLInputElement | null>(null);
  const dyRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-foreground">{el.name}</div>
      <div className="space-y-1 text-xs text-muted">
        <div>
          <span className="font-medium">Asset ID:</span>{' '}
          <span className="font-mono">{el.assetId}</span>
        </div>
        <div>
          <span className="font-medium">X:</span> {el.positionMm.xMm.toFixed(1)} mm
        </div>
        <div>
          <span className="font-medium">Y:</span> {el.positionMm.yMm.toFixed(1)} mm
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium">Rotation:</span>
          <input
            type="number"
            step={15}
            defaultValue={el.rotationDeg ?? 0}
            className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
            data-testid="inspector-asset-rotation"
            onChange={(e) => {
              void onSemanticCommand({
                type: 'updateElementProperty',
                elementId: el.id,
                key: 'rotationDeg',
                value: Number(e.target.value),
              });
            }}
          />
          <span>°</span>
        </div>
      </div>
      <div className="border-t border-border pt-2 space-y-1">
        <div
          className="text-[10px] font-semibold uppercase text-muted"
          style={{ letterSpacing: '0.08em', opacity: 0.7 }}
        >
          Move Δx/Δy (mm)
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted">
            Δx
            <input
              ref={dxRef}
              type="number"
              step={50}
              defaultValue={0}
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
              data-testid="inspector-asset-move-dx"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            Δy
            <input
              ref={dyRef}
              type="number"
              step={50}
              defaultValue={0}
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
              data-testid="inspector-asset-move-dy"
            />
          </label>
          <button
            type="button"
            className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-surface-strong"
            data-testid="inspector-asset-move-apply"
            onClick={() => {
              const dx = Number(dxRef.current?.value ?? 0);
              const dy = Number(dyRef.current?.value ?? 0);
              if (dx === 0 && dy === 0) return;
              void onSemanticCommand({
                type: 'moveAssetDelta',
                elementId: el.id,
                dxMm: dx,
                dyMm: dy,
              });
              if (dxRef.current) dxRef.current.value = '0';
              if (dyRef.current) dyRef.current.value = '0';
            }}
          >
            Apply
          </button>
        </div>
      </div>
      <div className="border-t border-border pt-2">
        <button
          type="button"
          className="rounded border border-border bg-surface px-2 py-0.5 text-xs text-red-500 hover:bg-surface-strong"
          data-testid="inspector-asset-delete"
          onClick={() => {
            void onSemanticCommand({ type: 'deleteElement', elementId: el.id });
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function ColumnInspector({
  el,
  onSemanticCommand,
  t,
}: {
  el: Extract<Element, { kind: 'column' }>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  t: ReturnType<typeof useTranslation>['t'];
}): JSX.Element {
  const dxRef = useRef<HTMLInputElement | null>(null);
  const dyRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="space-y-2">
      {InspectorPropertiesFor(el, t, {
        onPropertyChange: (property, value) =>
          void onSemanticCommand({
            type: 'updateElementProperty',
            elementId: el.id,
            key: property,
            value,
          }),
      })}
      <div
        className="border-t border-border pt-2 space-y-1"
        data-testid="inspector-column-move-delta"
      >
        <div
          className="text-[10px] font-semibold uppercase text-muted"
          style={{ letterSpacing: '0.08em', opacity: 0.7 }}
        >
          Move Δx/Δy (mm)
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted">
            Δx
            <input
              ref={dxRef}
              type="number"
              step={50}
              defaultValue={0}
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
              data-testid="inspector-column-move-dx"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-muted">
            Δy
            <input
              ref={dyRef}
              type="number"
              step={50}
              defaultValue={0}
              className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
              data-testid="inspector-column-move-dy"
            />
          </label>
          <button
            type="button"
            className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-surface-strong"
            data-testid="inspector-column-move-apply"
            onClick={() => {
              const dx = Number(dxRef.current?.value ?? 0);
              const dy = Number(dyRef.current?.value ?? 0);
              if (dx === 0 && dy === 0) return;
              void onSemanticCommand({
                type: 'moveColumnDelta',
                elementId: el.id,
                dxMm: dx,
                dyMm: dy,
              });
              if (dxRef.current) dxRef.current.value = '0';
              if (dyRef.current) dyRef.current.value = '0';
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/** F-022: Coordinate properties inspector for Project Base Point and Survey Point. */
function CoordinatePointInspector({
  el,
  onSemanticCommand,
}: {
  el: Extract<Element, { kind: 'project_base_point' | 'survey_point' }>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): JSX.Element {
  const label = el.kind === 'project_base_point' ? 'Project Base Point' : 'Survey Point';
  const elevationMm = el.kind === 'survey_point' ? el.sharedElevationMm : 0;

  function commitPosition(xMm: number, yMm: number) {
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: el.id,
      key: 'positionMm',
      value: { xMm, yMm, zMm: el.positionMm.zMm },
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-foreground">{label}</div>
      <div className="space-y-1 text-xs text-muted">
        <div className="flex items-center gap-1">
          <span className="font-medium w-20">X (E/W):</span>
          <input
            type="number"
            step={100}
            defaultValue={el.positionMm.xMm}
            aria-label="X coordinate (E/W) in mm"
            className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
            data-testid="inspector-coord-x"
            onBlur={(e) => {
              commitPosition(Number(e.target.value), el.positionMm.yMm);
            }}
          />
          <span>mm</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium w-20">Y (N/S):</span>
          <input
            type="number"
            step={100}
            defaultValue={el.positionMm.yMm}
            aria-label="Y coordinate (N/S) in mm"
            className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
            data-testid="inspector-coord-y"
            onBlur={(e) => {
              commitPosition(el.positionMm.xMm, Number(e.target.value));
            }}
          />
          <span>mm</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium w-20">Elevation:</span>
          <input
            type="number"
            value={elevationMm}
            readOnly
            aria-label="Elevation (read-only) in mm"
            className="w-24 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground opacity-60 cursor-not-allowed"
            data-testid="inspector-coord-elevation"
          />
          <span>mm</span>
        </div>
      </div>
      <div className="border-t border-border pt-2 space-y-1">
        <div
          className="text-[10px] font-semibold uppercase text-muted"
          style={{ letterSpacing: '0.08em', opacity: 0.7 }}
        >
          Shared Coordinates
        </div>
        <div className="text-xs text-muted">{label}</div>
        <div className="text-[10px] text-muted opacity-60">
          Used as origin reference for linked models
        </div>
      </div>
    </div>
  );
}

/** F-040: Inspector checkboxes for Allow/Disallow Join at each wall endpoint. */
function WallJoinDisallowSection({
  wall,
  onToggle,
}: {
  wall: Extract<Element, { kind: 'wall' }>;
  onToggle: (endpoint: 'start' | 'end', disallow: boolean) => void;
}): JSX.Element {
  const startDisallowed = wall.joinDisallowStart ?? false;
  const endDisallowed = wall.joinDisallowEnd ?? false;
  return (
    <div className="mt-3 border-t border-border pt-2 space-y-1">
      <div
        className="text-[10px] font-semibold uppercase text-muted"
        style={{ letterSpacing: '0.08em', opacity: 0.7 }}
      >
        Wall Join
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={startDisallowed}
          data-testid="inspector-wall-join-disallow-start"
          onChange={(e) => onToggle('start', e.target.checked)}
        />
        Disallow Join at Start
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={endDisallowed}
          data-testid="inspector-wall-join-disallow-end"
          onChange={(e) => onToggle('end', e.target.checked)}
        />
        Disallow Join at End
      </label>
    </div>
  );
}

function WallMoveSection({
  onMove,
}: {
  onMove: (dxMm: number, dyMm: number) => void;
}): JSX.Element {
  const dxRef = useRef<HTMLInputElement | null>(null);
  const dyRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className="mt-3 border-t border-border pt-2 space-y-1">
      <div
        className="text-[10px] font-semibold uppercase text-muted"
        style={{ letterSpacing: '0.08em', opacity: 0.7 }}
      >
        Move (mm)
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-muted">
          Δx
          <input
            ref={dxRef}
            type="number"
            step={50}
            defaultValue={0}
            className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
            data-testid="inspector-wall-move-dx"
          />
        </label>
        <label className="flex items-center gap-1 text-xs text-muted">
          Δy
          <input
            ref={dyRef}
            type="number"
            step={50}
            defaultValue={0}
            className="w-20 rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
            data-testid="inspector-wall-move-dy"
          />
        </label>
        <button
          type="button"
          className="rounded border border-border bg-surface px-2 py-0.5 text-xs hover:bg-surface-strong"
          data-testid="inspector-wall-move-apply"
          onClick={() => {
            const dx = Number(dxRef.current?.value ?? 0);
            const dy = Number(dyRef.current?.value ?? 0);
            if (dx === 0 && dy === 0) return;
            onMove(dx, dy);
            if (dxRef.current) dxRef.current.value = '0';
            if (dyRef.current) dyRef.current.value = '0';
          }}
        >
          Apply
        </button>
      </div>
    </div>
  );
}
