import type { JSX } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Element, ParamSchemaEntry } from '@bim-ai/core';

import { AdvisorPanel } from '../advisor/AdvisorPanel';
import { buildPlanGridDatumInspectorLine } from './readouts';
import { useBimStore } from '../state/store';
import { getTypeById } from '../families/familyCatalog';
import { BUILT_IN_FAMILIES } from '../families/familyCatalog';
import { familyInstanceProjectCategoryKey } from '../families/familyPlacementRuntime';
import type { FamilyDefinition, FamilyParamDef } from '../families/types';
import {
  buildAuthoredFamilyDefinition,
  FAMILY_EDITOR_DEFINITION_PARAM,
  FAMILY_EDITOR_DOCUMENT_PARAM,
  type AuthoredFamilyDocument,
} from '../familyEditor/familyEditorPersistence';
import {
  Inspector,
  InspectorConstraintsFor,
  InspectorDoorEditor,
  InspectorGraphicsFor,
  InspectorIdentityFor,
  type InspectorApplyScope,
  type InspectorPropertiesContext,
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
import { inspectorPropertiesContextForElement } from './WorkspaceRightRailContext';
import type { DisciplineTag } from '@bim-ai/core';
import { AuthoringWorkbenchesPanel } from './authoring';
import { Viewport3DLayersPanel } from './viewport';
import {
  elemViewerCategory,
  VIEWER_CATEGORY_KEYS,
  type ViewerCatKey,
} from '../viewport/sceneUtils';
import { elevationFromWall, sectionCutFromWall } from '../lib/sectionElevationFromWall';
import { firstSheetId, placeViewOnSheetCommand } from './sheets/sheetRecommendedViewports';
import type { WorkspaceMode } from './shell';
import { humanKindLabel, InspectorEmptyTab } from './WorkspaceHelpers';
import {
  isDuplicableTypeElement,
  type DuplicableTypeElement,
  typePropertyUpdateCommand,
} from './WorkspaceRightRailTypeCommands';

const NAVIGABLE_KINDS = new Set<Element['kind']>([
  'plan_view',
  'viewpoint',
  'section_cut',
  'sheet',
  'schedule',
]);

function newDuplicateTypeId(prefix: string): string {
  try {
    return `${prefix}-${crypto.randomUUID().slice(0, 10)}`;
  } catch {
    return `${prefix}-${Date.now().toString(36)}`;
  }
}

function duplicateTypePromptName(defaultName: string): string | null {
  if (typeof window === 'undefined' || typeof window.prompt !== 'function') return defaultName;
  const next = window.prompt('Duplicate type name', defaultName);
  if (next == null) return null;
  const trimmed = next.trim();
  return trimmed ? trimmed : defaultName;
}

export function duplicateTypePropertiesCommand(
  element: DuplicableTypeElement,
  nextId = newDuplicateTypeId(element.id),
  nextName?: string,
): Record<string, unknown> & { id: string } {
  if (element.kind === 'family_type') {
    const sourceName = String(element.parameters.name ?? element.name ?? element.id);
    const duplicateName = nextName?.trim() || `${sourceName} Copy`;
    const discipline =
      element.discipline === 'door' || element.discipline === 'window'
        ? element.discipline
        : 'generic';
    return {
      type: 'upsertFamilyType',
      id: nextId,
      discipline,
      parameters: {
        ...element.parameters,
        name: duplicateName,
      },
      ...(element.catalogSource ? { catalogSource: { ...element.catalogSource } } : {}),
    };
  }
  if (element.kind === 'wall_type') {
    return {
      type: 'upsertWallType',
      id: nextId,
      name: nextName?.trim() || `${element.name} Copy`,
      layers: element.layers.map((layer) => ({ ...layer })),
      basisLine: element.basisLine ?? 'center',
    };
  }
  if (element.kind === 'floor_type') {
    return {
      type: 'upsertFloorType',
      id: nextId,
      name: nextName?.trim() || `${element.name} Copy`,
      layers: element.layers.map((layer) => ({ ...layer })),
    };
  }
  return {
    type: 'upsertRoofType',
    id: nextId,
    name: nextName?.trim() || `${element.name} Copy`,
    layers: element.layers.map((layer) => ({ ...layer })),
  };
}

export function duplicateOpeningFamilyTypeCommand(
  familyTypeId: string | null | undefined,
  discipline: 'door' | 'window',
  elementsById: Record<string, Element>,
  nextId = newDuplicateTypeId(familyTypeId ?? `ft-${discipline}`),
  nextName?: string,
): (Record<string, unknown> & { id: string }) | null {
  if (!familyTypeId) return null;
  const custom = elementsById[familyTypeId];
  if (custom?.kind === 'family_type') {
    return duplicateTypePropertiesCommand(custom, nextId, nextName);
  }
  const builtIn = getTypeById(familyTypeId);
  if (!builtIn) return null;
  return {
    type: 'upsertFamilyType',
    id: nextId,
    discipline,
    parameters: {
      ...builtIn.parameters,
      name: nextName?.trim() || `${builtIn.name} Copy`,
      familyId: builtIn.familyId,
    },
  };
}

type FamilyTypeElement = Extract<Element, { kind: 'family_type' }>;

function isFamilyDefinition(value: unknown): value is FamilyDefinition {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    Array.isArray((value as { params?: unknown }).params),
  );
}

function familyDefinitionForType(type: FamilyTypeElement | undefined): FamilyDefinition | null {
  if (!type) return null;
  const embedded = type.parameters[FAMILY_EDITOR_DEFINITION_PARAM];
  if (isFamilyDefinition(embedded)) return embedded;
  const document = type.parameters[FAMILY_EDITOR_DOCUMENT_PARAM];
  if (document && typeof document === 'object') {
    return buildAuthoredFamilyDefinition(document as AuthoredFamilyDocument);
  }
  return BUILT_IN_FAMILIES.find((definition) => definition.id === type.familyId) ?? null;
}

function familyInstanceSiblingTypes(
  type: FamilyTypeElement | undefined,
  elementsById: Record<string, Element>,
): FamilyTypeElement[] {
  if (!type) return [];
  return Object.values(elementsById)
    .filter(
      (candidate): candidate is FamilyTypeElement =>
        candidate.kind === 'family_type' && candidate.familyId === type.familyId,
    )
    .sort((a, b) =>
      String(a.parameters.name ?? a.name).localeCompare(String(b.parameters.name ?? b.name)),
    );
}

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
  const viewerRenderStyle = useBimStore((s) => s.viewerRenderStyle);
  const setViewerRenderStyle = useBimStore((s) => s.setViewerRenderStyle);
  const viewerBackground = useBimStore((s) => s.viewerBackground);
  const setViewerBackground = useBimStore((s) => s.setViewerBackground);
  const viewerEdges = useBimStore((s) => s.viewerEdges);
  const setViewerEdges = useBimStore((s) => s.setViewerEdges);
  const viewerProjection = useBimStore((s) => s.viewerProjection);
  const setViewerProjection = useBimStore((s) => s.setViewerProjection);
  const viewerSectionBoxActive = useBimStore((s) => s.viewerSectionBoxActive);
  const setViewerSectionBoxActive = useBimStore((s) => s.setViewerSectionBoxActive);
  const viewerWalkModeActive = useBimStore((s) => s.viewerWalkModeActive);
  const setViewerWalkModeActive = useBimStore((s) => s.setViewerWalkModeActive);
  const requestViewerCameraAction = useBimStore((s) => s.requestViewerCameraAction);
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
  const viewerCategoryCounts = useMemo(() => {
    const counts: Partial<Record<ViewerCatKey, number>> = {};
    for (const element of Object.values(elementsById) as Element[]) {
      const key = elemViewerCategory(element);
      if (key) counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }, [elementsById]);
  const setAllViewerCategoriesHidden = useCallback((hidden: boolean): void => {
    useBimStore.setState({
      viewerCategoryHidden: Object.fromEntries(VIEWER_CATEGORY_KEYS.map((key) => [key, hidden])),
    });
  }, []);
  const show3dLayers = mode === '3d' || (mode as string) === 'plan-3d';
  const showAuthoringWorkbenches =
    mode === 'plan' ||
    (mode as string) === 'plan-3d' ||
    (el ? !NAVIGABLE_KINDS.has(el.kind) : false);
  const inspectorPropertiesContext = inspectorPropertiesContextForElement(el);

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
  const emptySelectionPanel = (
    <RightRailEmptySelection
      mode={mode}
      activePlanViewName={
        activePlanViewId && elementsById[activePlanViewId]?.kind === 'plan_view'
          ? (elementsById[activePlanViewId] as Extract<Element, { kind: 'plan_view' }>).name
          : undefined
      }
      has3dControls={show3dLayers}
    />
  );

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
      <RightRailSectionTabs
        showView={show3dLayers || Boolean(activePlanViewId)}
        showWorkbench={showAuthoringWorkbenches}
      />
      {/* VIS-V3-04: Scene section — visible when no element is selected */}
      {!selectedId ? (
        <div id="right-rail-view-scene" className="border-b border-border p-3">
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
      <div id="right-rail-properties" style={{ position: 'relative' }}>
        <Inspector
          key={selectedId ?? 'none'}
          selection={inspectorSelection}
          propertiesContext={inspectorPropertiesContext}
          siblingCount={inspectorPropertiesContext === 'type' ? 1 : siblingCount}
          onApplyScopeChange={handleApplyScopeChange}
          tabs={{
            properties: el ? (
              <>
                <InspectorSelectionContextBanner
                  element={el}
                  context={inspectorPropertiesContext}
                />
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
                  onDuplicateType={(typeElement) => {
                    const defaultName = `${typeElement.name} Copy`;
                    const nextName = duplicateTypePromptName(defaultName);
                    if (nextName == null) return;
                    const cmd = duplicateTypePropertiesCommand(typeElement, undefined, nextName);
                    void Promise.resolve(onSemanticCommand(cmd)).then(() => select(cmd.id));
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
                    onDuplicateType={(familyTypeId) => {
                      const existing = familyTypeId ? elementsById[familyTypeId] : undefined;
                      const builtIn = getTypeById(familyTypeId ?? '');
                      const defaultName = `${
                        existing?.kind === 'family_type' ? existing.name : (builtIn?.name ?? 'Door')
                      } Copy`;
                      const nextName = duplicateTypePromptName(defaultName);
                      if (nextName == null) return;
                      const cmd = duplicateOpeningFamilyTypeCommand(
                        familyTypeId,
                        'door',
                        elementsById,
                        undefined,
                        nextName,
                      );
                      if (!cmd) return;
                      void Promise.resolve(onSemanticCommand(cmd)).then(() =>
                        onSemanticCommand({
                          type: 'updateElementProperty',
                          elementId: el.id,
                          key: 'familyTypeId',
                          value: cmd.id,
                        }),
                      );
                    }}
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
                    onDuplicateType={(familyTypeId) => {
                      const existing = familyTypeId ? elementsById[familyTypeId] : undefined;
                      const builtIn = getTypeById(familyTypeId ?? '');
                      const defaultName = `${
                        existing?.kind === 'family_type'
                          ? existing.name
                          : (builtIn?.name ?? 'Window')
                      } Copy`;
                      const nextName = duplicateTypePromptName(defaultName);
                      if (nextName == null) return;
                      const cmd = duplicateOpeningFamilyTypeCommand(
                        familyTypeId,
                        'window',
                        elementsById,
                        undefined,
                        nextName,
                      );
                      if (!cmd) return;
                      void Promise.resolve(onSemanticCommand(cmd)).then(() =>
                        onSemanticCommand({
                          type: 'updateElementProperty',
                          elementId: el.id,
                          key: 'familyTypeId',
                          value: cmd.id,
                        }),
                      );
                    }}
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
                ) : el.kind === 'masking_region' ? (
                  InspectorPropertiesFor(el, t, {
                    elementsById,
                    onPropertyChange: (property, value) =>
                      void onSemanticCommand({
                        type: 'updateMaskingRegion',
                        maskingRegionId: el.id,
                        [property]: value,
                      }),
                  })
                ) : el.kind === 'placed_asset' ? (
                  <PlacedAssetInspector
                    el={el as Extract<Element, { kind: 'placed_asset' }>}
                    assetEntry={
                      elementsById[(el as Extract<Element, { kind: 'placed_asset' }>).assetId]
                        ?.kind === 'asset_library_entry'
                        ? (elementsById[
                            (el as Extract<Element, { kind: 'placed_asset' }>).assetId
                          ] as Extract<Element, { kind: 'asset_library_entry' }>)
                        : undefined
                    }
                    onSemanticCommand={onSemanticCommand}
                  />
                ) : el.kind === 'family_instance' ? (
                  <FamilyInstanceInspector
                    el={el as Extract<Element, { kind: 'family_instance' }>}
                    familyType={
                      elementsById[
                        (el as Extract<Element, { kind: 'family_instance' }>).familyTypeId
                      ]?.kind === 'family_type'
                        ? (elementsById[
                            (el as Extract<Element, { kind: 'family_instance' }>).familyTypeId
                          ] as FamilyTypeElement)
                        : undefined
                    }
                    elementsById={elementsById}
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
                    onPropertyChange: (property, value) => {
                      if (isDuplicableTypeElement(el)) {
                        void onSemanticCommand(typePropertyUpdateCommand(el, property, value));
                        return;
                      }
                      void onSemanticCommand({
                        type: 'updateElementProperty',
                        elementId: el.id,
                        key: property,
                        value,
                      });
                    },
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
                        const categoryKey =
                          el.kind === 'family_instance'
                            ? familyInstanceProjectCategoryKey(
                                el as Extract<Element, { kind: 'family_instance' }>,
                                elementsById,
                              )
                            : el.kind;
                        useBimStore
                          .getState()
                          .setCategoryOverride(activePlanViewId, categoryKey, { visible: false });
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
              emptySelectionPanel
            ),
            constraints: el ? (
              InspectorConstraintsFor(el, t)
            ) : (
              <InspectorEmptyTab message="Select a model element to inspect constraints and hosts." />
            ),
            identity: el ? (
              InspectorIdentityFor(el, t)
            ) : (
              <InspectorEmptyTab message="Select a view, sheet, schedule, or model element to inspect identity." />
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
              <InspectorEmptyTab message="Select a documented item to inspect provenance and evidence." />
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
        <div id="right-rail-view" className="border-t border-border">
          {el?.kind === 'wall' ? (
            <SelectedWall3dActions
              wall={el}
              onSemanticCommand={onSemanticCommand}
              onIsolateWalls={() => {
                const next = Object.fromEntries(
                  VIEWER_CATEGORY_KEYS.map((key) => [key, key !== 'wall']),
                );
                useBimStore.setState({ viewerCategoryHidden: next });
              }}
              onHideWallCategory={() => {
                if (!viewerCategoryHidden.wall) toggleViewerCategoryHidden('wall');
              }}
            />
          ) : null}
          <Viewport3DLayersPanel
            viewerCategoryHidden={viewerCategoryHidden}
            onToggleCategory={toggleViewerCategoryHidden}
            onSetAllCategoriesHidden={setAllViewerCategoriesHidden}
            categoryCounts={viewerCategoryCounts}
            viewerRenderStyle={viewerRenderStyle}
            onSetRenderStyle={setViewerRenderStyle}
            viewerBackground={viewerBackground}
            onSetBackground={setViewerBackground}
            viewerEdges={viewerEdges}
            onSetEdges={setViewerEdges}
            viewerProjection={viewerProjection}
            onSetProjection={setViewerProjection}
            sectionBoxActive={viewerSectionBoxActive}
            onSetSectionBoxActive={setViewerSectionBoxActive}
            viewerWalkModeActive={viewerWalkModeActive}
            onSetWalkModeActive={setViewerWalkModeActive}
            onRequestCameraAction={requestViewerCameraAction}
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
        <div id="right-rail-workbench" className="border-t border-border">
          <AuthoringWorkbenchesPanel
            selected={el}
            elementsById={elementsById}
            activeLevelId={activeLevelId ?? ''}
            onUpsertSemantic={(cmd) => void onSemanticCommand(cmd)}
          />
        </div>
      ) : null}
      <div id="right-rail-review" className="border-t border-border p-3">
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

function SelectedWall3dActions({
  wall,
  onSemanticCommand,
  onIsolateWalls,
  onHideWallCategory,
}: {
  wall: Extract<Element, { kind: 'wall' }>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  onIsolateWalls: () => void;
  onHideWallCategory: () => void;
}): JSX.Element {
  const dispatch = (cmd: Record<string, unknown>): void => {
    void onSemanticCommand(cmd);
  };
  return (
    <div className="border-b border-border p-3" data-testid="selected-wall-3d-actions">
      <div
        className="mb-2 text-[10px] font-semibold uppercase text-muted"
        style={{ letterSpacing: '0.08em', opacity: 0.7 }}
      >
        3D wall actions
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <ActionButton
          testId="3d-action-insert-door"
          label="Insert Door"
          onClick={() => dispatch(insertDoorOnWallCenterCommand(wall))}
        />
        <ActionButton
          testId="3d-action-insert-window"
          label="Insert Window"
          onClick={() => dispatch(insertWindowOnWallCenterCommand(wall))}
        />
        <ActionButton
          testId="3d-action-insert-opening"
          label="Opening"
          onClick={() => dispatch(createWallOpeningCenterCommand(wall))}
        />
        <ActionButton
          testId="3d-action-section"
          label="Section"
          onClick={() => dispatch(createSectionFromWallCommand(wall).cmd)}
        />
        <ActionButton
          testId="3d-action-elevation"
          label="Elevation"
          onClick={() => dispatch(createElevationFromWallCommand(wall).cmd)}
        />
        <ActionButton testId="3d-action-isolate-walls" label="Isolate" onClick={onIsolateWalls} />
        <ActionButton
          testId="3d-action-hide-wall-category"
          label="Hide Walls"
          onClick={onHideWallCategory}
        />
      </div>
    </div>
  );
}

function RightRailSectionTabs({
  showView,
  showWorkbench,
}: {
  showView: boolean;
  showWorkbench: boolean;
}): JSX.Element {
  const tabs = [
    { id: 'properties', label: 'Properties', target: 'right-rail-properties', visible: true },
    {
      id: 'view',
      label: 'View',
      target: 'right-rail-view',
      fallbackTarget: 'right-rail-view-scene',
      visible: showView,
    },
    { id: 'workbench', label: 'Workbench', target: 'right-rail-workbench', visible: showWorkbench },
    { id: 'review', label: 'Review', target: 'right-rail-review', visible: true },
  ].filter((tab) => tab.visible);

  return (
    <div
      role="tablist"
      aria-label="Right rail sections"
      data-testid="right-rail-section-tabs"
      className="sticky top-0 z-10 flex gap-1 border-b border-border bg-surface px-2 py-2"
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected="false"
          data-testid={`right-rail-section-tab-${tab.id}`}
          onClick={() => {
            const target =
              document.getElementById(tab.target) ??
              (tab.fallbackTarget ? document.getElementById(tab.fallbackTarget) : null);
            target?.scrollIntoView({ block: 'start' });
          }}
          className="rounded border border-border bg-background px-2 py-1 text-[11px] font-medium text-muted hover:bg-surface-strong hover:text-foreground"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function ActionButton({
  label,
  testId,
  onClick,
}: {
  label: string;
  testId: string;
  onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="rounded border border-border bg-background px-2 py-1.5 text-left text-[11px] font-medium text-foreground hover:bg-surface-strong"
    >
      {label}
    </button>
  );
}

function insertDoorOnWallCenterCommand(
  wall: Extract<Element, { kind: 'wall' }>,
): Record<string, unknown> {
  return {
    type: 'insertDoorOnWall',
    wallId: wall.id,
    alongT: 0.5,
    widthMm: 900,
  };
}

function insertWindowOnWallCenterCommand(
  wall: Extract<Element, { kind: 'wall' }>,
): Record<string, unknown> {
  return {
    type: 'insertWindowOnWall',
    wallId: wall.id,
    alongT: 0.5,
    widthMm: 1200,
    sillHeightMm: 900,
    heightMm: 1500,
  };
}

function createWallOpeningCenterCommand(
  wall: Extract<Element, { kind: 'wall' }>,
): Record<string, unknown> {
  return {
    type: 'createWallOpening',
    hostWallId: wall.id,
    alongTStart: 0.45,
    alongTEnd: 0.55,
    sillHeightMm: 200,
    headHeightMm: 2400,
  };
}

function createSectionFromWallCommand(wall: Extract<Element, { kind: 'wall' }>): {
  id: string;
  cmd: Record<string, unknown>;
} {
  const params = sectionCutFromWall(wall);
  const id = `sc-${crypto.randomUUID().slice(0, 10)}`;
  return {
    id,
    cmd: {
      type: 'createSectionCut',
      id,
      name: params.name,
      lineStartMm: params.lineStartMm,
      lineEndMm: params.lineEndMm,
      cropDepthMm: params.cropDepthMm,
    },
  };
}

function createElevationFromWallCommand(wall: Extract<Element, { kind: 'wall' }>): {
  id: string;
  cmd: Record<string, unknown>;
} {
  const params = elevationFromWall(wall);
  const id = `ev-${crypto.randomUUID().slice(0, 10)}`;
  const cmd: Record<string, unknown> = {
    type: 'createElevationView',
    id,
    name: params.name,
    direction: params.direction,
    cropMinMm: params.cropMinMm,
    cropMaxMm: params.cropMaxMm,
  };
  if (params.direction === 'custom' && params.customAngleDeg !== null) {
    cmd.customAngleDeg = params.customAngleDeg;
  }
  return { id, cmd };
}

function InspectorContextActions({
  element,
  firstSheetId,
  onNavigateToElement,
  onPlaceRecommendedViews,
  onDuplicatePlanView,
  onDuplicateType,
  onResetSavedView,
  onUpdateSavedView,
}: {
  element: Element;
  firstSheetId: string | null;
  onNavigateToElement?: (elementId: string) => void;
  onPlaceRecommendedViews: (sheetId: string) => void;
  onDuplicatePlanView: (planView: Extract<Element, { kind: 'plan_view' }>) => void;
  onDuplicateType: (element: DuplicableTypeElement) => void;
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

  if (isDuplicableTypeElement(element)) {
    buttons.push(
      <button
        key="duplicate-type"
        type="button"
        data-testid="inspector-duplicate-type"
        className="rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:bg-surface"
        onClick={() => onDuplicateType(element)}
      >
        Duplicate type
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

function RightRailEmptySelection({
  mode,
  activePlanViewName,
  has3dControls,
}: {
  mode: WorkspaceMode;
  activePlanViewName?: string;
  has3dControls: boolean;
}): JSX.Element {
  const title =
    mode === 'schedule'
      ? 'Schedule review'
      : mode === 'sheet'
        ? 'Sheet review'
        : mode === '3d' || (mode as string) === 'plan-3d'
          ? '3D review'
          : 'Plan editing';
  const body =
    mode === 'schedule'
      ? 'Select a schedule row to highlight its source element, or select a schedule in the browser for sheet placement and identity.'
      : mode === 'sheet'
        ? 'Select a sheet viewport or documentation item to edit placement, crop, identity, and review context.'
        : mode === '3d' || (mode as string) === 'plan-3d'
          ? 'Select model geometry to inspect properties. View controls stay below for graphics, camera, section box, and hidden categories.'
          : activePlanViewName
            ? `Editing ${activePlanViewName}. Select an element, or use the tool palette to draw and annotate.`
            : 'Select an element, or use the tool palette to draw walls, openings, rooms, dimensions, and annotations.';

  return (
    <div className="space-y-2 text-[11px]">
      <div className="rounded border border-border bg-surface-strong p-2">
        <div className="font-medium text-foreground">{title}</div>
        <p className="mt-1 leading-snug text-muted">{body}</p>
      </div>
      {has3dControls ? (
        <div className="rounded border border-border bg-background p-2 text-muted">
          Graphics, projection, walk mode, fit/reset, and section box controls are available in View
          controls below.
        </div>
      ) : null}
    </div>
  );
}

function InspectorSelectionContextBanner({
  element,
  context,
}: {
  element: Element;
  context: InspectorPropertiesContext;
}): JSX.Element | null {
  if (context !== 'type') return null;
  return (
    <div
      data-testid="inspector-type-context"
      className="mb-3 rounded border border-accent/40 bg-accent/10 p-2 text-[11px]"
    >
      <div className="font-medium text-foreground">Type Properties</div>
      <p className="mt-1 leading-snug text-muted">
        Editing {(element as { name?: string }).name ?? element.id} updates this type definition;
        placed instances keep their own instance parameters.
      </p>
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
  assetEntry,
  onSemanticCommand,
}: {
  el: Extract<Element, { kind: 'placed_asset' }>;
  assetEntry?: Extract<Element, { kind: 'asset_library_entry' }>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): JSX.Element {
  const dxRef = useRef<HTMLInputElement | null>(null);
  const dyRef = useRef<HTMLInputElement | null>(null);
  const params = assetEntry?.paramSchema ?? [];

  function currentParamValue(param: ParamSchemaEntry): unknown {
    return el.paramValues && param.key in el.paramValues
      ? el.paramValues[param.key]
      : param.default;
  }

  function commitParamValue(param: ParamSchemaEntry, value: unknown): void {
    const next = { ...(el.paramValues ?? {}), [param.key]: value };
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: el.id,
      key: 'paramValues',
      value: next,
    });
  }

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
      {params.length > 0 ? (
        <div className="border-t border-border pt-2 space-y-2">
          <div
            className="text-[10px] font-semibold uppercase text-muted"
            style={{ letterSpacing: '0.08em', opacity: 0.7 }}
          >
            Instance Parameters
          </div>
          {params.map((param) => (
            <PlacedAssetParamField
              key={param.key}
              param={param}
              value={currentParamValue(param)}
              onCommit={(value) => commitParamValue(param, value)}
            />
          ))}
        </div>
      ) : null}
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

function FamilyInstanceInspector({
  el,
  familyType,
  elementsById,
  onSemanticCommand,
}: {
  el: Extract<Element, { kind: 'family_instance' }>;
  familyType?: FamilyTypeElement;
  elementsById: Record<string, Element>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): JSX.Element {
  const params =
    familyDefinitionForType(familyType)?.params.filter((param) => param.instanceOverridable) ?? [];
  const siblingTypes = familyInstanceSiblingTypes(familyType, elementsById);

  function currentParamValue(param: FamilyParamDef): unknown {
    if (el.paramValues && param.key in el.paramValues) return el.paramValues[param.key];
    if (familyType?.parameters && param.key in familyType.parameters) {
      return familyType.parameters[param.key];
    }
    return param.default;
  }

  function commitParamValue(param: FamilyParamDef, value: unknown): void {
    void onSemanticCommand({
      type: 'updateElementProperty',
      elementId: el.id,
      key: 'paramValues',
      value: { ...(el.paramValues ?? {}), [param.key]: value },
    });
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-foreground">{el.name}</div>
      <label className="flex flex-col gap-1 text-xs text-muted">
        Type
        <select
          className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
          value={el.familyTypeId}
          data-testid="inspector-family-instance-type"
          onChange={(event) => {
            void onSemanticCommand({
              type: 'updateElementProperty',
              elementId: el.id,
              key: 'familyTypeId',
              value: event.target.value,
            });
          }}
        >
          {siblingTypes.length === 0 ? (
            <option value={el.familyTypeId}>{familyType?.name ?? el.familyTypeId}</option>
          ) : (
            siblingTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {String(type.parameters.name ?? type.name)}
              </option>
            ))
          )}
        </select>
      </label>
      <div className="space-y-1 text-xs text-muted">
        <div>
          <span className="font-medium">X:</span> {el.positionMm.xMm.toFixed(1)} mm
        </div>
        <div>
          <span className="font-medium">Y:</span> {el.positionMm.yMm.toFixed(1)} mm
        </div>
        <div>
          <span className="font-medium">Rotation:</span> {el.rotationDeg ?? 0}°
        </div>
      </div>
      {params.length > 0 ? (
        <div className="border-t border-border pt-2 space-y-2">
          <div
            className="text-[10px] font-semibold uppercase text-muted"
            style={{ letterSpacing: '0.08em', opacity: 0.7 }}
          >
            Instance Parameters
          </div>
          {params.map((param) => (
            <FamilyInstanceParamField
              key={param.key}
              param={param}
              value={currentParamValue(param)}
              onCommit={(value) => commitParamValue(param, value)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded border border-border bg-background p-2 text-xs text-muted">
          This family type has no instance parameters.
        </div>
      )}
    </div>
  );
}

function FamilyInstanceParamField({
  param,
  value,
  onCommit,
}: {
  param: FamilyParamDef;
  value: unknown;
  onCommit: (value: unknown) => void;
}): JSX.Element {
  const label =
    param.type === 'length_mm' ? `${param.label || param.key} (mm)` : param.label || param.key;
  const fieldId = `inspector-family-instance-param-${param.key}`;

  if (param.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={Boolean(value)}
          data-testid={fieldId}
          onChange={(event) => onCommit(event.target.checked)}
        />
        {param.label || param.key}
      </label>
    );
  }

  if (param.type === 'option') {
    const options = param.options ?? [];
    return (
      <label className="flex flex-col gap-1 text-xs text-muted">
        {label}
        <select
          value={String(value ?? '')}
          className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
          data-testid={fieldId}
          onChange={(event) => onCommit(event.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (param.type === 'length_mm' || param.type === 'angle_deg') {
    return (
      <label className="flex flex-col gap-1 text-xs text-muted">
        {label}
        <input
          type="number"
          step={param.type === 'angle_deg' ? 1 : 25}
          value={Number.isFinite(Number(value)) ? Number(value) : Number(param.default ?? 0)}
          className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
          data-testid={fieldId}
          onChange={(event) => onCommit(Number(event.target.value))}
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input
        type="text"
        value={String(value ?? '')}
        className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
        data-testid={fieldId}
        onChange={(event) => onCommit(event.target.value)}
      />
    </label>
  );
}

function PlacedAssetParamField({
  param,
  value,
  onCommit,
}: {
  param: ParamSchemaEntry;
  value: unknown;
  onCommit: (value: unknown) => void;
}): JSX.Element {
  const label = param.kind === 'mm' ? `${param.key} (mm)` : param.key;
  const fieldId = `inspector-asset-param-${param.key}`;

  if (param.kind === 'bool') {
    return (
      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={Boolean(value)}
          data-testid={fieldId}
          onChange={(e) => onCommit(e.target.checked)}
        />
        {param.key}
      </label>
    );
  }

  if (param.kind === 'enum') {
    const opts = Array.isArray(param.constraints) ? (param.constraints as string[]) : [];
    return (
      <label className="flex flex-col gap-1 text-xs text-muted">
        {label}
        <select
          value={String(value ?? '')}
          className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
          data-testid={fieldId}
          onChange={(e) => onCommit(e.target.value)}
        >
          {opts.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (param.kind === 'mm') {
    return (
      <label className="flex flex-col gap-1 text-xs text-muted">
        {label}
        <input
          type="number"
          step={25}
          value={Number.isFinite(Number(value)) ? Number(value) : Number(param.default ?? 0)}
          className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
          data-testid={fieldId}
          onChange={(e) => onCommit(Number(e.target.value))}
        />
      </label>
    );
  }

  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      {label}
      <input
        type="text"
        value={String(value ?? '')}
        className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-foreground"
        data-testid={fieldId}
        onChange={(e) => onCommit(e.target.value)}
      />
    </label>
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
  const clipped = el.clipped ?? false;

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
      <label className="flex items-center justify-between gap-2 rounded border border-border bg-surface/60 px-2 py-1 text-xs text-foreground">
        <span>{clipped ? 'Clipped' : 'Unclipped'}</span>
        <input
          type="checkbox"
          checked={clipped}
          data-testid="inspector-coordinate-clipped"
          aria-label={`${label} clipped`}
          onChange={(e) =>
            void onSemanticCommand({
              type: 'updateElementProperty',
              elementId: el.id,
              key: 'clipped',
              value: e.currentTarget.checked,
            })
          }
        />
      </label>
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
