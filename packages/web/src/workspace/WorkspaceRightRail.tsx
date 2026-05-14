import type { JSX, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Element, LensMode, ParamSchemaEntry } from '@bim-ai/core';

import { buildPlanGridDatumInspectorLine } from './readouts';
import { useBimStore } from '../state/store';
import type { ViewerRenderStyle } from '../state/storeTypes';
import {
  OrbitViewpointPersistedHud,
  type OrbitViewpointPersistFieldPayload,
} from '../OrbitViewpointPersistedHud';
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
  type MaterialBrowserTargetRequest,
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
import { PersistedDisclosureSection } from './shell/components/PersistedDisclosureSection';
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

const VIEWPOINT_LEVEL_VISIBILITY_STORAGE_KEY = 'bim.viewer.levelHiddenByViewpoint.v1';

function readViewpointLevelVisibility(): Record<string, Record<string, boolean>> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(VIEWPOINT_LEVEL_VISIBILITY_STORAGE_KEY) ?? '{}',
    );
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, Record<string, boolean>> = {};
    for (const [viewId, rawMap] of Object.entries(parsed as Record<string, unknown>)) {
      if (!rawMap || typeof rawMap !== 'object') continue;
      out[viewId] = Object.fromEntries(
        Object.entries(rawMap as Record<string, unknown>).map(([levelId, hidden]) => [
          levelId,
          Boolean(hidden),
        ]),
      );
    }
    return out;
  } catch {
    return {};
  }
}

function writeViewpointLevelVisibility(map: Record<string, Record<string, boolean>>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VIEWPOINT_LEVEL_VISIBILITY_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* noop */
  }
}

function buildDefaultLevelVisibilityMapForLens(
  levels: Array<Extract<Element, { kind: 'level' }>>,
  elementsById: Record<string, Element>,
  lensMode: LensMode,
): Record<string, boolean> {
  if (lensMode !== 'structure') return {};
  const structuralKinds = new Set<Element['kind']>([
    'wall',
    'floor',
    'roof',
    'column',
    'beam',
    'stair',
    'railing',
  ]);
  const structuralLevelIds = new Set<string>();
  for (const element of Object.values(elementsById) as Element[]) {
    if (!structuralKinds.has(element.kind)) continue;
    if ('levelId' in element && typeof element.levelId === 'string') {
      structuralLevelIds.add(element.levelId);
    }
    if (
      element.kind === 'stair' &&
      typeof element.baseLevelId === 'string' &&
      typeof element.topLevelId === 'string'
    ) {
      structuralLevelIds.add(element.baseLevelId);
      structuralLevelIds.add(element.topLevelId);
    }
  }
  return Object.fromEntries(levels.map((level) => [level.id, !structuralLevelIds.has(level.id)]));
}

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

type MaterialEditableType = Extract<Element, { kind: 'wall_type' | 'floor_type' | 'roof_type' }>;
type MaterialEditableInstance = Extract<
  Element,
  {
    kind:
      | 'toposolid'
      | 'toposolid_subdivision'
      | 'wall'
      | 'door'
      | 'window'
      | 'roof'
      | 'column'
      | 'beam'
      | 'text_3d'
      | 'sweep'
      | 'mass'
      | 'pipe';
  }
>;

function hasInstanceMaterialKey(element: Element): element is MaterialEditableInstance {
  switch (element.kind) {
    case 'toposolid':
    case 'toposolid_subdivision':
    case 'wall':
    case 'door':
    case 'window':
    case 'roof':
    case 'column':
    case 'beam':
    case 'text_3d':
    case 'sweep':
    case 'mass':
    case 'pipe':
      return true;
    default:
      return false;
  }
}

function hasMaterialEditableTarget(
  element: Element,
  elementsById: Record<string, Element>,
): boolean {
  if (
    element.kind === 'wall_type' ||
    element.kind === 'floor_type' ||
    element.kind === 'roof_type'
  ) {
    return true;
  }
  if (element.kind === 'wall' && element.wallTypeId) {
    return elementsById[element.wallTypeId]?.kind === 'wall_type';
  }
  if (element.kind === 'roof' && element.roofTypeId) {
    return elementsById[element.roofTypeId]?.kind === 'roof_type';
  }
  if (hasInstanceMaterialKey(element)) return true;
  if (element.kind === 'floor') {
    const typeId = element.floorTypeId;
    if (!typeId) return false;
    const type = elementsById[typeId];
    return type?.kind === 'floor_type';
  }
  return false;
}

export function WorkspaceRightRail({
  mode,
  onSemanticCommand,
  onModeChange,
  onNavigateToElement,
  activeViewTargetId,
  lensMode: lensModeProp,
  surface,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
}: {
  mode: WorkspaceMode;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  onModeChange: (mode: WorkspaceMode) => void;
  onNavigateToElement?: (elementId: string) => void;
  activeViewTargetId?: string;
  lensMode?: LensMode;
  surface: 'view-context' | 'element';
  onOpenMaterialBrowser?: (target?: MaterialBrowserTargetRequest) => void;
  onOpenAppearanceAssetBrowser?: (target?: MaterialBrowserTargetRequest) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const selectedId = useBimStore((s) => s.selectedId);
  const selectedIds = useBimStore((s) => s.selectedIds);
  const select = useBimStore((s) => s.select);
  const elementsById = useBimStore((s) => s.elementsById);
  const revision = useBimStore((s) => s.revision);
  const activeLevelId = useBimStore((s) => s.activeLevelId);
  const setActiveLevelId = useBimStore((s) => s.setActiveLevelId);
  const viewerCategoryHidden = useBimStore((s) => s.viewerCategoryHidden);
  const viewerLevelHidden = useBimStore((s) => s.viewerLevelHidden);
  const toggleViewerCategoryHidden = useBimStore((s) => s.toggleViewerCategoryHidden);
  const toggleViewerLevelHidden = useBimStore((s) => s.toggleViewerLevelHidden);
  const setViewerLevelVisibilityMap = useBimStore((s) => s.setViewerLevelVisibilityMap);
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
  const modelId = useBimStore((s) => s.modelId);
  const activeWorkspaceId = useBimStore((s) => s.activeWorkspaceId);
  const storeLensMode = useBimStore((s) => s.lensMode);
  const lensMode = lensModeProp ?? storeLensMode;
  const setPlanTool = useBimStore((s) => s.setPlanTool);
  const planProjectionPrimitives = useBimStore((s) => s.planProjectionPrimitives);
  const activePlanViewId = useBimStore((s) => s.activePlanViewId);
  const revealHiddenMode = useBimStore((s) => s.revealHiddenMode);
  const setRevealHiddenMode = useBimStore((s) => s.setRevealHiddenMode);
  const openVVDialog = useBimStore((s) => s.openVVDialog);
  const temporaryVisibility = useBimStore((s) => s.temporaryVisibility);
  const setTemporaryVisibility = useBimStore((s) => s.setTemporaryVisibility);
  const clearTemporaryVisibility = useBimStore((s) => s.clearTemporaryVisibility);
  const thinLinesEnabled = useBimStore((s) => s.thinLinesEnabled);
  const toggleThinLines = useBimStore((s) => s.toggleThinLines);
  const el = selectedId ? (elementsById[selectedId] as Element | undefined) : undefined;
  const selectedElements = useMemo(() => {
    const ids = [...new Set([selectedId, ...selectedIds].filter((id): id is string => !!id))];
    return ids.map((id) => elementsById[id]).filter((item): item is Element => Boolean(item));
  }, [elementsById, selectedId, selectedIds]);
  const activeViewTarget = activeViewTargetId
    ? (elementsById[activeViewTargetId] as Element | undefined)
    : undefined;
  const activeViewpoint =
    activeViewpointId && elementsById[activeViewpointId]?.kind === 'viewpoint'
      ? (elementsById[activeViewpointId] as Extract<Element, { kind: 'viewpoint' }>)
      : activeViewTarget?.kind === 'viewpoint'
        ? (activeViewTarget as Extract<Element, { kind: 'viewpoint' }>)
        : undefined;
  const levels = useMemo(
    () =>
      (Object.values(elementsById) as Element[])
        .filter(
          (candidate): candidate is Extract<Element, { kind: 'level' }> =>
            candidate.kind === 'level',
        )
        .sort((a, b) => a.elevationMm - b.elevationMm),
    [elementsById],
  );
  const planViews = useMemo(
    () =>
      (Object.values(elementsById) as Element[])
        .filter(
          (candidate): candidate is Extract<Element, { kind: 'plan_view' }> =>
            candidate.kind === 'plan_view',
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [elementsById],
  );
  const activePlanView =
    activePlanViewId && elementsById[activePlanViewId]?.kind === 'plan_view'
      ? (elementsById[activePlanViewId] as Extract<Element, { kind: 'plan_view' }>)
      : activeViewTarget?.kind === 'plan_view'
        ? (activeViewTarget as Extract<Element, { kind: 'plan_view' }>)
        : (planViews.find((view) => view.levelId === activeLevelId) ?? planViews[0]);
  const activeSection =
    activeViewTarget?.kind === 'section_cut'
      ? (activeViewTarget as Extract<Element, { kind: 'section_cut' }>)
      : (Object.values(elementsById) as Element[]).find(
          (candidate): candidate is Extract<Element, { kind: 'section_cut' }> =>
            candidate.kind === 'section_cut',
        );
  const activeSheet =
    activeViewTarget?.kind === 'sheet'
      ? (activeViewTarget as Extract<Element, { kind: 'sheet' }>)
      : (Object.values(elementsById) as Element[]).find(
          (candidate): candidate is Extract<Element, { kind: 'sheet' }> =>
            candidate.kind === 'sheet',
        );
  const activeSchedule =
    activeViewTarget?.kind === 'schedule'
      ? (activeViewTarget as Extract<Element, { kind: 'schedule' }>)
      : (Object.values(elementsById) as Element[]).find(
          (candidate): candidate is Extract<Element, { kind: 'schedule' }> =>
            candidate.kind === 'schedule',
        );
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
  const isolateViewerCategory = useCallback((category: ViewerCatKey): void => {
    useBimStore.setState({
      viewerCategoryHidden: Object.fromEntries(
        VIEWER_CATEGORY_KEYS.map((key) => [key, key !== category]),
      ),
    });
  }, []);
  const levelVisibilityOptions = useMemo(
    () =>
      levels.map((level) => ({
        id: level.id,
        hidden: Boolean(viewerLevelHidden[level.id]),
        label: `${level.name} · ${(level.elevationMm / 1000).toFixed(2)} m`,
      })),
    [levels, viewerLevelHidden],
  );
  const setAllViewerLevelsHidden = useCallback(
    (hidden: boolean): void => {
      setViewerLevelVisibilityMap(Object.fromEntries(levels.map((level) => [level.id, hidden])));
    },
    [levels, setViewerLevelVisibilityMap],
  );
  const showOnlyViewerLevel = useCallback(
    (levelId: string): void => {
      setViewerLevelVisibilityMap(
        Object.fromEntries(levels.map((level) => [level.id, level.id !== levelId])),
      );
    },
    [levels, setViewerLevelVisibilityMap],
  );
  const show3dLayers = mode === '3d';
  const showAuthoringWorkbenches = mode === 'plan' || (el ? !NAVIGABLE_KINDS.has(el.kind) : false);
  const showViewContextSurface = surface === 'view-context';
  const showElementSurface = surface === 'element';
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

  const focusSelectionTab = useCallback((elementId: string): void => {
    const ids = [
      ...new Set(
        [useBimStore.getState().selectedId, ...useBimStore.getState().selectedIds].filter(
          (id): id is string => typeof id === 'string',
        ),
      ),
    ];
    useBimStore.setState({
      selectedId: elementId,
      selectedIds: ids.filter((id) => id !== elementId),
    });
  }, []);

  const deleteCurrentSelection = useCallback((): void => {
    const ids = [
      ...new Set(
        [useBimStore.getState().selectedId, ...useBimStore.getState().selectedIds].filter(
          (id): id is string => typeof id === 'string',
        ),
      ),
    ].filter((id) => Boolean(elementsById[id]));
    if (ids.length === 0) return;
    void onSemanticCommand(
      ids.length === 1
        ? { type: 'deleteElement', elementId: ids[0] }
        : { type: 'deleteElements', elementIds: ids },
    );
    useBimStore.getState().select(undefined);
  }, [elementsById, onSemanticCommand]);

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
  const persistActiveViewpointField = useCallback(
    (payload: OrbitViewpointPersistFieldPayload) => {
      if (!activeViewpoint || activeViewpoint.mode !== 'orbit_3d') return;
      if (payload.elementId !== activeViewpoint.id) return;
      void onSemanticCommand({ type: 'updateElementProperty', ...payload });
    },
    [activeViewpoint, onSemanticCommand],
  );

  const persistPlanViewProperty = useCallback(
    (planViewId: string, key: string, value: string) => {
      if (key === '__applyTemplate__') {
        const p = JSON.parse(value) as { planViewId: string; templateId: string };
        void onSemanticCommand({ type: 'applyPlanViewTemplate', ...p });
        return;
      }
      if (key === '__saveAsTemplate__') {
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
        return;
      }
      void onSemanticCommand({
        type: 'updateElementProperty',
        elementId: planViewId,
        key,
        value,
      });
    },
    [onSemanticCommand],
  );

  useEffect(() => {
    if (!show3dLayers) return;
    const viewpointId = activeViewpoint?.id ?? activeViewpointId ?? null;
    if (!viewpointId) {
      setViewerLevelVisibilityMap({});
      return;
    }
    const perViewpointMap = readViewpointLevelVisibility();
    const saved = perViewpointMap[viewpointId];
    if (saved && Object.keys(saved).length > 0) {
      setViewerLevelVisibilityMap(saved);
      return;
    }
    setViewerLevelVisibilityMap(
      buildDefaultLevelVisibilityMapForLens(levels, elementsById, lensMode),
    );
  }, [
    activeViewpoint?.id,
    activeViewpointId,
    elementsById,
    lensMode,
    levels,
    setViewerLevelVisibilityMap,
    show3dLayers,
  ]);

  useEffect(() => {
    if (!show3dLayers) return;
    const viewpointId = activeViewpoint?.id ?? activeViewpointId ?? null;
    if (!viewpointId) return;
    const perViewpointMap = readViewpointLevelVisibility();
    perViewpointMap[viewpointId] = { ...viewerLevelHidden };
    writeViewpointLevelVisibility(perViewpointMap);
  }, [activeViewpoint?.id, activeViewpointId, show3dLayers, viewerLevelHidden]);

  if (surface === 'view-context') {
    return (
      <div
        className="h-full overflow-y-auto bg-surface"
        data-testid="workspace-secondary-sidebar"
        data-view-mode={mode}
      >
        {lensMode !== 'all' ? (
          <LensScopeNotice testId="secondary-lens-scope-notice" lensMode={lensMode} scope="view" />
        ) : null}
        {mode === '3d' ? (
          <Secondary3dAdapter
            activeViewpoint={activeViewpoint}
            planViews={planViews}
            persistViewpointField={persistActiveViewpointField}
            viewerCategoryHidden={viewerCategoryHidden}
            toggleViewerCategoryHidden={toggleViewerCategoryHidden}
            setAllViewerCategoriesHidden={setAllViewerCategoriesHidden}
            viewerCategoryCounts={viewerCategoryCounts}
            levelVisibilityOptions={levelVisibilityOptions}
            toggleViewerLevelHidden={toggleViewerLevelHidden}
            setAllViewerLevelsHidden={setAllViewerLevelsHidden}
            showOnlyViewerLevel={showOnlyViewerLevel}
            viewerRenderStyle={viewerRenderStyle}
            setViewerRenderStyle={setViewerRenderStyle}
            viewerBackground={viewerBackground}
            setViewerBackground={setViewerBackground}
            viewerEdges={viewerEdges}
            setViewerEdges={setViewerEdges}
            viewerProjection={viewerProjection}
            setViewerProjection={setViewerProjection}
            viewerSectionBoxActive={viewerSectionBoxActive}
            setViewerSectionBoxActive={setViewerSectionBoxActive}
            viewerWalkModeActive={viewerWalkModeActive}
            setViewerWalkModeActive={setViewerWalkModeActive}
            requestViewerCameraAction={requestViewerCameraAction}
            viewerClipElevMm={viewerClipElevMm}
            setViewerClipElevMm={setViewerClipElevMm}
            viewerClipFloorElevMm={viewerClipFloorElevMm}
            setViewerClipFloorElevMm={setViewerClipFloorElevMm}
            resetActiveSavedView={activeViewpoint ? resetActiveSavedView : undefined}
            updateActiveSavedView={activeViewpoint ? updateActiveSavedView : undefined}
          />
        ) : mode === 'section' ? (
          <SecondarySectionAdapter
            section={activeSection}
            firstSheetId={firstSheet}
            onSemanticCommand={onSemanticCommand}
          />
        ) : mode === 'sheet' ? (
          <SecondarySheetAdapter sheet={activeSheet} elementsById={elementsById} />
        ) : mode === 'schedule' ? (
          <SecondaryScheduleAdapter schedule={activeSchedule} elementsById={elementsById} />
        ) : (
          <SecondaryPlanAdapter
            activePlanView={activePlanView}
            activeLevelId={activeLevelId}
            levels={levels}
            revision={revision}
            elementsById={elementsById}
            setActiveLevelId={setActiveLevelId}
            persistPlanViewProperty={persistPlanViewProperty}
            revealHiddenMode={revealHiddenMode}
            setRevealHiddenMode={setRevealHiddenMode}
            openPlanVisibilityGraphics={openVVDialog}
            thinLinesEnabled={thinLinesEnabled}
            toggleThinLines={toggleThinLines}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {showElementSurface && lensMode !== 'all' ? (
        <LensScopeNotice testId="element-lens-scope-notice" lensMode={lensMode} scope="element" />
      ) : null}
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
      {showViewContextSurface ? (
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
      {showElementSurface ? (
        <div id="right-rail-properties" style={{ position: 'relative' }}>
          {selectedElements.length > 1 ? (
            <SelectionTabs
              elements={selectedElements}
              activeId={selectedId}
              onSelect={focusSelectionTab}
              onDeleteSelection={deleteCurrentSelection}
            />
          ) : null}
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
                  <InspectorDisciplineScope element={el} activeWorkspaceId={activeWorkspaceId} />
                  <InspectorContextActions
                    element={el}
                    elementsById={elementsById}
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
                    onOpenMaterialBrowser={onOpenMaterialBrowser}
                    onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
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
                          existing?.kind === 'family_type'
                            ? existing.name
                            : (builtIn?.name ?? 'Door')
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
                      onOpenMaterialBrowser={onOpenMaterialBrowser}
                      onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
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
                      onOpenMaterialBrowser={onOpenMaterialBrowser}
                      onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
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
                        onOpenMaterialBrowser,
                        onOpenAppearanceAssetBrowser,
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
                      onOpenMaterialBrowser={onOpenMaterialBrowser}
                      onOpenAppearanceAssetBrowser={onOpenAppearanceAssetBrowser}
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
                      onOpenMaterialBrowser,
                      onOpenAppearanceAssetBrowser,
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
                      <div
                        data-testid="element-temp-visibility-actions"
                        className="mt-1 flex w-full flex-wrap gap-1"
                      >
                        {temporaryVisibility ? (
                          <button
                            data-testid="element-temp-visibility-reset"
                            type="button"
                            onClick={() => clearTemporaryVisibility()}
                            style={{
                              fontSize: 11,
                              padding: '2px 8px',
                              cursor: 'pointer',
                              color: 'var(--color-warning-foreground)',
                              background: 'var(--color-warning)',
                            }}
                            title="Reset temporary visibility overrides"
                          >
                            Reset Temporary Visibility
                          </button>
                        ) : null}
                        <button
                          data-testid="element-temp-isolate-element"
                          type="button"
                          onClick={() =>
                            setTemporaryVisibility({
                              viewId: activePlanViewId,
                              mode: 'isolate',
                              categories: [],
                              elementIds: [el.id],
                            })
                          }
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            cursor: 'pointer',
                            color: 'var(--color-muted)',
                          }}
                          title="Temporarily isolate this element in the active plan view"
                        >
                          Temp Isolate Element
                        </button>
                        <button
                          data-testid="element-temp-hide-element"
                          type="button"
                          onClick={() =>
                            setTemporaryVisibility({
                              viewId: activePlanViewId,
                              mode: 'hide',
                              categories: [],
                              elementIds: [el.id],
                            })
                          }
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            cursor: 'pointer',
                            color: 'var(--color-muted)',
                          }}
                          title="Temporarily hide this element in the active plan view"
                        >
                          Temp Hide Element
                        </button>
                        <button
                          data-testid="element-temp-isolate-category"
                          type="button"
                          onClick={() => {
                            const categoryKey =
                              el.kind === 'family_instance'
                                ? familyInstanceProjectCategoryKey(
                                    el as Extract<Element, { kind: 'family_instance' }>,
                                    elementsById,
                                  )
                                : el.kind;
                            setTemporaryVisibility({
                              viewId: activePlanViewId,
                              mode: 'isolate',
                              categories: [categoryKey],
                              elementIds: [],
                            });
                          }}
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            cursor: 'pointer',
                            color: 'var(--color-muted)',
                          }}
                          title="Temporarily isolate this category in the active plan view"
                        >
                          Temp Isolate Category
                        </button>
                      </div>
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
                  if (mode !== 'plan') onModeChange('plan');
                  setPlanTool('wall');
                },
              },
              {
                hotkey: 'D',
                label: 'Insert a door',
                onTrigger: () => {
                  if (mode !== 'plan') onModeChange('plan');
                  setPlanTool('door');
                },
              },
              {
                hotkey: 'M',
                label: 'Drop a room marker',
                onTrigger: () => {
                  if (mode !== 'plan') onModeChange('plan');
                  setPlanTool('room');
                },
              },
            ]}
            onClearSelection={() => useBimStore.getState().select(undefined)}
          />
        </div>
      ) : null}
      {show3dLayers && (showViewContextSurface || (showElementSurface && el)) ? (
        <div id="right-rail-view" className="border-t border-border">
          {showElementSurface && el?.kind === 'wall' ? (
            <SelectedWall3dActions
              wall={el}
              onSemanticCommand={onSemanticCommand}
              onIsolateWalls={() => isolateViewerCategory('wall')}
              onHideWallCategory={() => {
                if (!viewerCategoryHidden.wall) toggleViewerCategoryHidden('wall');
              }}
            />
          ) : showElementSurface && isSelected3dActionElement(el) ? (
            <Selected3dElementActions
              element={el}
              elementsById={elementsById}
              onSelect={select}
              onIsolateCategory={isolateViewerCategory}
              onHideCategory={(category) => {
                if (!viewerCategoryHidden[category]) toggleViewerCategoryHidden(category);
              }}
            />
          ) : null}
          {showViewContextSurface ? (
            <Viewport3DLayersPanel
              viewerCategoryHidden={viewerCategoryHidden}
              onToggleCategory={toggleViewerCategoryHidden}
              onSetAllCategoriesHidden={setAllViewerCategoriesHidden}
              categoryCounts={viewerCategoryCounts}
              levelVisibilityOptions={levelVisibilityOptions}
              onToggleLevelVisibility={toggleViewerLevelHidden}
              onSetAllLevelsHidden={setAllViewerLevelsHidden}
              onShowOnlyLevel={showOnlyViewerLevel}
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
          ) : null}
        </div>
      ) : null}
      {showViewContextSurface && showAuthoringWorkbenches ? (
        <div id="right-rail-workbench" className="border-t border-border">
          <AuthoringWorkbenchesPanel
            selected={el}
            elementsById={elementsById}
            activeLevelId={activeLevelId ?? ''}
            onUpsertSemantic={(cmd) => void onSemanticCommand(cmd)}
          />
        </div>
      ) : null}
    </div>
  );
}

function SelectionTabs({
  elements,
  activeId,
  onSelect,
  onDeleteSelection,
}: {
  elements: Element[];
  activeId: string | undefined;
  onSelect: (elementId: string) => void;
  onDeleteSelection: () => void;
}): JSX.Element {
  return (
    <div className="border-b border-border bg-surface" data-testid="element-selection-tabs">
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        <div className="min-w-0 text-[11px] font-medium text-muted">{elements.length} selected</div>
        <button
          type="button"
          className="shrink-0 rounded border border-border px-2 py-1 text-[11px] text-muted hover:text-foreground"
          data-testid="element-selection-delete"
          onClick={onDeleteSelection}
        >
          Delete Selection
        </button>
      </div>
      <div
        role="tablist"
        aria-label="Selected elements"
        className="mt-2 flex gap-1 overflow-x-auto px-3"
      >
        {elements.map((element) => {
          const active = element.id === activeId;
          const name = (element as { name?: string }).name ?? element.id;
          const label = `${humanKindLabel(element.kind)} · ${name}`;
          return (
            <button
              key={element.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={[
                'min-w-28 max-w-44 shrink-0 truncate border-b-2 px-2 py-2 text-left text-[12px]',
                active
                  ? 'border-accent font-medium text-foreground'
                  : 'border-transparent text-muted hover:text-foreground',
              ].join(' ')}
              title={label}
              data-testid={`element-selection-tab-${element.id}`}
              onClick={() => onSelect(element.id)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SecondaryHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}): JSX.Element {
  return (
    <div className="border-b border-border px-3 py-3">
      <div
        className="text-[10px] font-semibold uppercase text-muted"
        style={{ letterSpacing: '0.08em', opacity: 0.75 }}
      >
        {eyebrow}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">{title}</div>
      {subtitle ? <div className="mt-0.5 truncate text-[11px] text-muted">{subtitle}</div> : null}
    </div>
  );
}

function SecondarySection({
  title,
  children,
  testId,
  scope = 'view-state',
}: {
  title: string;
  children: ReactNode;
  testId?: string;
  scope?: 'view-summary' | 'view-state' | 'advanced';
}): JSX.Element {
  return (
    <section
      className="border-b border-border px-3 py-3"
      data-testid={testId}
      data-secondary-scope={scope}
      data-secondary-disclosure="false"
    >
      <div
        className="mb-2 text-[10px] font-semibold uppercase text-muted"
        style={{ letterSpacing: '0.08em', opacity: 0.7 }}
      >
        {title}
      </div>
      {children}
    </section>
  );
}

function SecondaryField({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-2 text-[11px]">
      <span className="text-muted">{label}</span>
      <span className="min-w-0 truncate text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function LensScopeNotice({
  lensMode,
  scope,
  testId,
}: {
  lensMode: LensMode;
  scope: 'view' | 'element';
  testId: string;
}): JSX.Element {
  const lensLabel =
    lensMode === 'structure' ? 'Structure' : lensMode === 'mep' ? 'MEP' : 'Architecture';
  const body =
    scope === 'view'
      ? `${lensLabel} lens is active. View controls and command availability are filtered for this discipline.`
      : `${lensLabel} lens is active. Out-of-scope elements remain inspectable, but editing commands may be unavailable.`;
  return (
    <div
      data-testid={testId}
      className="mx-3 mt-3 rounded border border-border bg-surface-strong px-2 py-1.5 text-[11px] text-muted"
    >
      {body}
    </div>
  );
}

function SecondaryToggle({
  label,
  checked,
  onChange,
  testId,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  testId?: string;
}): JSX.Element {
  return (
    <label className="flex items-center justify-between gap-3 rounded border border-border bg-background px-2 py-1.5 text-[11px] text-foreground">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        data-testid={testId}
      />
    </label>
  );
}

function SecondaryPlanAdapter({
  activePlanView,
  activeLevelId,
  levels,
  revision,
  elementsById,
  setActiveLevelId,
  persistPlanViewProperty,
  revealHiddenMode,
  setRevealHiddenMode,
  openPlanVisibilityGraphics,
  thinLinesEnabled,
  toggleThinLines,
}: {
  activePlanView?: Extract<Element, { kind: 'plan_view' }>;
  activeLevelId: string | undefined;
  levels: Extract<Element, { kind: 'level' }>[];
  revision: number;
  elementsById: Record<string, Element>;
  setActiveLevelId: (levelId: string) => void;
  persistPlanViewProperty: (planViewId: string, key: string, value: string) => void;
  revealHiddenMode: boolean;
  setRevealHiddenMode: (enabled: boolean) => void;
  openPlanVisibilityGraphics: () => void;
  thinLinesEnabled: boolean;
  toggleThinLines: () => void;
}): JSX.Element {
  const activeLevel = levels.find(
    (level) => level.id === (activePlanView?.levelId ?? activeLevelId),
  );
  const visibilityDisclosureId = `plan.visibility.${activePlanView?.id ?? activeLevel?.id ?? 'default'}`;
  return (
    <div data-testid="secondary-sidebar-plan">
      <SecondaryHeader
        eyebrow="Floor plan"
        title={activePlanView?.name ?? activeLevel?.name ?? 'Plan view'}
        subtitle={activePlanView ? `View id · ${activePlanView.id}` : 'Level-based plan context'}
      />
      <SecondarySection title="Level" testId="secondary-plan-level" scope="view-summary">
        <label className="flex flex-col gap-1 text-[11px] text-muted">
          Active level
          <select
            value={activeLevel?.id ?? ''}
            onChange={(event) => setActiveLevelId(event.target.value)}
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
          >
            {levels.length === 0 ? <option value="">No levels</option> : null}
            {levels.map((level) => (
              <option key={level.id} value={level.id}>
                {level.name} · {(level.elevationMm / 1000).toFixed(2)} m
              </option>
            ))}
          </select>
        </label>
        {activePlanView ? (
          <div className="mt-2 space-y-1">
            <SecondaryField label="Associated view" value={activePlanView.name} />
            <SecondaryField
              label="Reference level"
              value={activeLevel?.name ?? activePlanView.levelId}
            />
          </div>
        ) : null}
      </SecondarySection>
      <SecondarySection title="View State" testId="secondary-plan-view-state">
        {activePlanView ? (
          <InspectorPlanViewEditor
            el={activePlanView}
            elementsById={elementsById}
            revision={revision}
            onPersistProperty={(key, value) =>
              persistPlanViewProperty(activePlanView.id, key, value)
            }
          />
        ) : (
          <p className="text-[11px] leading-snug text-muted">
            Open a named floor plan from the primary navigation to edit range, crop, graphics,
            underlay, phase, and template settings.
          </p>
        )}
      </SecondarySection>
      <PersistedDisclosureSection
        title="Visibility"
        disclosureId={visibilityDisclosureId}
        testId="secondary-plan-visibility"
        scope="advanced"
      >
        <div className="space-y-2">
          <SecondaryToggle
            label="Reveal hidden elements"
            checked={revealHiddenMode}
            onChange={setRevealHiddenMode}
            testId="secondary-reveal-hidden-toggle"
          />
          <SecondaryToggle
            label="Thin lines"
            checked={thinLinesEnabled}
            onChange={() => toggleThinLines()}
            testId="secondary-thin-lines-toggle"
          />
          <button
            type="button"
            data-testid="secondary-plan-open-vv-dialog"
            onClick={openPlanVisibilityGraphics}
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-left text-xs text-foreground hover:bg-surface-strong"
          >
            Open Visibility/Graphics Overrides…
          </button>
        </div>
      </PersistedDisclosureSection>
    </div>
  );
}

type Secondary3dAdapterProps = {
  activeViewpoint?: Extract<Element, { kind: 'viewpoint' }>;
  planViews: Array<Extract<Element, { kind: 'plan_view' }>>;
  persistViewpointField: (payload: OrbitViewpointPersistFieldPayload) => void;
  viewerCategoryHidden: Record<string, boolean>;
  toggleViewerCategoryHidden: (kind: ViewerCatKey) => void;
  setAllViewerCategoriesHidden: (hidden: boolean) => void;
  viewerCategoryCounts: Partial<Record<ViewerCatKey, number>>;
  levelVisibilityOptions: Array<{ id: string; label: string; hidden: boolean }>;
  toggleViewerLevelHidden: (levelId: string) => void;
  setAllViewerLevelsHidden: (hidden: boolean) => void;
  showOnlyViewerLevel: (levelId: string) => void;
  viewerRenderStyle: ViewerRenderStyle;
  setViewerRenderStyle: (style: ViewerRenderStyle) => void;
  viewerBackground: 'white' | 'light_grey' | 'dark';
  setViewerBackground: (bg: 'white' | 'light_grey' | 'dark') => void;
  viewerEdges: 'normal' | 'none';
  setViewerEdges: (edges: 'normal' | 'none') => void;
  viewerProjection: 'perspective' | 'orthographic';
  setViewerProjection: (projection: 'perspective' | 'orthographic') => void;
  viewerSectionBoxActive: boolean;
  setViewerSectionBoxActive: (active: boolean) => void;
  viewerWalkModeActive: boolean;
  setViewerWalkModeActive: (active: boolean) => void;
  requestViewerCameraAction: (kind: 'fit' | 'reset') => void;
  viewerClipElevMm: number | null;
  setViewerClipElevMm: (mm: number | null) => void;
  viewerClipFloorElevMm: number | null;
  setViewerClipFloorElevMm: (mm: number | null) => void;
  resetActiveSavedView?: () => void;
  updateActiveSavedView?: () => void;
};

function Secondary3dAdapter(props: Secondary3dAdapterProps): JSX.Element {
  const graphicsDisclosureId = `3d.graphics.${props.activeViewpoint?.id ?? 'live-camera'}`;
  return (
    <div data-testid="secondary-sidebar-3d">
      <SecondaryHeader
        eyebrow="3D view"
        title={props.activeViewpoint?.name ?? 'Orbit 3D'}
        subtitle={
          props.activeViewpoint ? `Saved viewpoint · ${props.activeViewpoint.id}` : 'Live camera'
        }
      />
      <SecondarySection title="Scene" testId="secondary-3d-sun">
        <SunInspectorPanel />
      </SecondarySection>
      <PersistedDisclosureSection
        title="Graphics, Camera, Clipping"
        disclosureId={graphicsDisclosureId}
        testId="secondary-3d-graphics"
        scope="advanced"
      >
        <Viewport3DLayersPanel
          viewerCategoryHidden={props.viewerCategoryHidden}
          onToggleCategory={props.toggleViewerCategoryHidden}
          onSetAllCategoriesHidden={props.setAllViewerCategoriesHidden}
          categoryCounts={props.viewerCategoryCounts}
          levelVisibilityOptions={props.levelVisibilityOptions}
          onToggleLevelVisibility={props.toggleViewerLevelHidden}
          onSetAllLevelsHidden={props.setAllViewerLevelsHidden}
          onShowOnlyLevel={props.showOnlyViewerLevel}
          viewerRenderStyle={props.viewerRenderStyle}
          onSetRenderStyle={props.setViewerRenderStyle}
          viewerBackground={props.viewerBackground}
          onSetBackground={props.setViewerBackground}
          viewerEdges={props.viewerEdges}
          onSetEdges={props.setViewerEdges}
          viewerProjection={props.viewerProjection}
          onSetProjection={props.setViewerProjection}
          sectionBoxActive={props.viewerSectionBoxActive}
          onSetSectionBoxActive={props.setViewerSectionBoxActive}
          viewerWalkModeActive={props.viewerWalkModeActive}
          onSetWalkModeActive={props.setViewerWalkModeActive}
          onRequestCameraAction={props.requestViewerCameraAction}
          viewerClipElevMm={props.viewerClipElevMm}
          onSetClipElevMm={props.setViewerClipElevMm}
          viewerClipFloorElevMm={props.viewerClipFloorElevMm}
          onSetClipFloorElevMm={props.setViewerClipFloorElevMm}
          activeViewpointId={props.activeViewpoint?.id}
          onResetToSavedView={props.resetActiveSavedView}
          onUpdateSavedView={props.updateActiveSavedView}
        />
      </PersistedDisclosureSection>
      {props.activeViewpoint?.mode === 'orbit_3d' ? (
        <SecondarySection title="Saved Viewpoint Overrides" testId="secondary-3d-saved-view">
          <OrbitViewpointPersistedHud
            layout="panel"
            activeViewpointId={props.activeViewpoint.id}
            viewpoint={props.activeViewpoint}
            planViews={props.planViews}
            onPersistField={props.persistViewpointField}
          />
        </SecondarySection>
      ) : null}
    </div>
  );
}

function SecondarySectionAdapter({
  section,
  firstSheetId,
  onSemanticCommand,
}: {
  section?: Extract<Element, { kind: 'section_cut' }>;
  firstSheetId: string | null;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
}): JSX.Element {
  return (
    <div data-testid="secondary-sidebar-section">
      <SecondaryHeader
        eyebrow="Section"
        title={section?.name ?? 'Section view'}
        subtitle={section ? `Cut id · ${section.id}` : 'No section selected'}
      />
      <SecondarySection title="Cut Context" testId="secondary-section-context">
        <div className="space-y-1">
          <SecondaryField
            label="Depth"
            value={section?.cropDepthMm ? `${section.cropDepthMm} mm` : 'Default'}
          />
          <SecondaryField
            label="Line start"
            value={section ? `${section.lineStartMm.xMm}, ${section.lineStartMm.yMm}` : '—'}
          />
          <SecondaryField
            label="Line end"
            value={section ? `${section.lineEndMm.xMm}, ${section.lineEndMm.yMm}` : '—'}
          />
          <SecondaryField
            label="Sheet placement"
            value={firstSheetId ? 'Sheet available' : 'No sheet'}
          />
        </div>
      </SecondarySection>
      {section ? (
        <PersistedDisclosureSection
          title="Crop Depth"
          disclosureId={`section.crop-depth.${section.id}`}
          scope="advanced"
          testId="secondary-section-crop-depth"
        >
          <label className="flex flex-col gap-1 text-[11px] text-muted">
            Depth mm
            <input
              className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
              defaultValue={section.cropDepthMm ?? ''}
              onBlur={(event) => {
                const raw = event.target.value.trim();
                void onSemanticCommand({
                  type: 'updateElementProperty',
                  elementId: section.id,
                  key: 'cropDepthMm',
                  value: raw ? Number(raw) : null,
                });
              }}
            />
          </label>
        </PersistedDisclosureSection>
      ) : null}
    </div>
  );
}

function SecondarySheetAdapter({
  sheet,
  elementsById,
}: {
  sheet?: Extract<Element, { kind: 'sheet' }>;
  elementsById: Record<string, Element>;
}): JSX.Element {
  const placements = sheet?.viewPlacements ?? [];
  const legacyViewports = sheet?.viewportsMm ?? [];
  return (
    <div data-testid="secondary-sidebar-sheet">
      <SecondaryHeader
        eyebrow="Sheet"
        title={sheet?.name ?? 'Sheet view'}
        subtitle={sheet?.number ? `Sheet ${sheet.number}` : 'Documentation sheet'}
      />
      <SecondarySection title="Sheet Setup" testId="secondary-sheet-setup">
        <div className="space-y-1">
          <SecondaryField label="Size" value={sheet?.size ?? 'Default'} />
          <SecondaryField label="Orientation" value={sheet?.orientation ?? 'Default'} />
          <SecondaryField
            label="Titleblock"
            value={sheet?.titleblockTypeId ?? sheet?.titleBlock ?? 'None'}
          />
          <SecondaryField label="Revision" value={sheet?.revisionId ?? 'None'} />
        </div>
      </SecondarySection>
      <SecondarySection title="Viewports" testId="secondary-sheet-viewports">
        {placements.length || legacyViewports.length ? (
          <div className="space-y-1 text-[11px] text-foreground">
            {placements.map((placement, index) => {
              const ref = elementsById[placement.viewId];
              return (
                <div
                  key={`${placement.viewId}-${index}`}
                  className="rounded border border-border bg-background px-2 py-1"
                >
                  <span className="block truncate">
                    {(ref as { name?: string } | undefined)?.name ?? placement.viewId}
                  </span>
                  <span className="text-muted">1:{placement.scale ?? 'default'}</span>
                </div>
              );
            })}
            {legacyViewports.length ? (
              <div className="rounded border border-border bg-background px-2 py-1 text-muted">
                {legacyViewports.length} legacy viewport{legacyViewports.length === 1 ? '' : 's'}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-[11px] text-muted">No placed views on this sheet.</p>
        )}
      </SecondarySection>
    </div>
  );
}

function SecondaryScheduleAdapter({
  schedule,
  elementsById,
}: {
  schedule?: Extract<Element, { kind: 'schedule' }>;
  elementsById: Record<string, Element>;
}): JSX.Element {
  const placedCount = schedule
    ? (Object.values(elementsById) as Element[]).filter(
        (element) =>
          element.kind === 'sheet' &&
          ((element.viewPlacements ?? []).some((placement) => placement.viewId === schedule.id) ||
            (element.viewportsMm ?? []).some((viewport) =>
              JSON.stringify(viewport).includes(schedule.id),
            )),
      ).length
    : 0;
  return (
    <div data-testid="secondary-sidebar-schedule">
      <SecondaryHeader
        eyebrow="Schedule"
        title={schedule?.name ?? 'Schedule view'}
        subtitle={schedule?.category ? `Category · ${schedule.category}` : 'Table definition'}
      />
      <SecondarySection title="Definition" testId="secondary-schedule-definition">
        <div className="space-y-1">
          <SecondaryField label="Fields" value={schedule?.columns?.length ?? 0} />
          <SecondaryField
            label="Filter"
            value={schedule?.filterExpr ?? (schedule?.filters ? 'Configured' : 'None')}
          />
          <SecondaryField
            label="Sort"
            value={schedule?.sortKey ? `${schedule.sortKey} ${schedule.sortDir ?? ''}` : 'None'}
          />
          <SecondaryField label="Grouping" value={schedule?.grouping ? 'Configured' : 'None'} />
          <SecondaryField label="Placed on sheets" value={placedCount} />
        </div>
      </SecondarySection>
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

type Selected3dActionElement =
  | Extract<Element, { kind: 'door' }>
  | Extract<Element, { kind: 'window' }>
  | Extract<Element, { kind: 'floor' }>
  | Extract<Element, { kind: 'roof' }>;

function isSelected3dActionElement(
  element: Element | undefined,
): element is Selected3dActionElement {
  return (
    element?.kind === 'door' ||
    element?.kind === 'window' ||
    element?.kind === 'floor' ||
    element?.kind === 'roof'
  );
}

const VIEWER_CATEGORY_LABEL: Partial<Record<ViewerCatKey, string>> = {
  door: 'Doors',
  window: 'Windows',
  floor: 'Floors',
  roof: 'Roofs',
};

function selected3dTypeId(element: Selected3dActionElement): string | null {
  if (element.kind === 'door' || element.kind === 'window') return element.familyTypeId ?? null;
  if (element.kind === 'floor') return element.floorTypeId ?? null;
  return element.roofTypeId ?? null;
}

function Selected3dElementActions({
  element,
  elementsById,
  onSelect,
  onIsolateCategory,
  onHideCategory,
}: {
  element: Selected3dActionElement;
  elementsById: Record<string, Element>;
  onSelect: (id: string | undefined) => void;
  onIsolateCategory: (category: ViewerCatKey) => void;
  onHideCategory: (category: ViewerCatKey) => void;
}): JSX.Element | null {
  const category = elemViewerCategory(element);
  if (!category) return null;

  const categoryLabel = VIEWER_CATEGORY_LABEL[category] ?? category;
  const typeId = selected3dTypeId(element);
  const hostWallId = element.kind === 'door' || element.kind === 'window' ? element.wallId : null;
  const canSelectHost = Boolean(hostWallId && elementsById[hostWallId]?.kind === 'wall');
  const canEditType = Boolean(typeId && elementsById[typeId]);

  return (
    <div className="border-b border-border p-3" data-testid="selected-3d-element-actions">
      <div
        className="mb-2 text-[10px] font-semibold uppercase text-muted"
        style={{ letterSpacing: '0.08em', opacity: 0.7 }}
      >
        3D {element.kind} actions
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <ActionButton
          testId={`3d-action-${element.kind}-isolate-category`}
          label={`Isolate ${categoryLabel}`}
          onClick={() => onIsolateCategory(category)}
        />
        <ActionButton
          testId={`3d-action-${element.kind}-hide-category`}
          label={`Hide ${categoryLabel}`}
          onClick={() => onHideCategory(category)}
        />
        {canSelectHost ? (
          <ActionButton
            testId={`3d-action-${element.kind}-select-host`}
            label="Select Host"
            onClick={() => onSelect(hostWallId ?? undefined)}
          />
        ) : null}
        {canEditType ? (
          <ActionButton
            testId={`3d-action-${element.kind}-edit-type`}
            label="Edit Type"
            onClick={() => onSelect(typeId ?? undefined)}
          />
        ) : null}
      </div>
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
  elementsById,
  firstSheetId,
  onNavigateToElement,
  onPlaceRecommendedViews,
  onDuplicatePlanView,
  onDuplicateType,
  onResetSavedView,
  onUpdateSavedView,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
}: {
  element: Element;
  elementsById: Record<string, Element>;
  firstSheetId: string | null;
  onNavigateToElement?: (elementId: string) => void;
  onPlaceRecommendedViews: (sheetId: string) => void;
  onDuplicatePlanView: (planView: Extract<Element, { kind: 'plan_view' }>) => void;
  onDuplicateType: (element: DuplicableTypeElement) => void;
  onResetSavedView: () => void;
  onUpdateSavedView: () => void;
  onOpenMaterialBrowser?: (target?: MaterialBrowserTargetRequest) => void;
  onOpenAppearanceAssetBrowser?: (target?: MaterialBrowserTargetRequest) => void;
}): JSX.Element | null {
  const buttons: JSX.Element[] = [];
  const hasMaterialTarget = hasMaterialEditableTarget(element, elementsById);

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

  if (hasMaterialTarget && onOpenMaterialBrowser) {
    buttons.push(
      <button
        key="open-material-browser"
        type="button"
        data-testid="inspector-open-material-browser"
        className="rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:bg-surface"
        onClick={() => onOpenMaterialBrowser()}
      >
        Materials…
      </button>,
    );
  }

  if (hasMaterialTarget && onOpenAppearanceAssetBrowser) {
    buttons.push(
      <button
        key="open-appearance-asset-browser"
        type="button"
        data-testid="inspector-open-appearance-asset-browser"
        className="rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground hover:bg-surface"
        onClick={() => onOpenAppearanceAssetBrowser()}
      >
        Appearance Assets…
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
        : mode === '3d'
          ? '3D review'
          : 'Plan editing';
  const body =
    mode === 'schedule'
      ? 'Select a schedule row to highlight its source element, or select a schedule in the browser for sheet placement and identity.'
      : mode === 'sheet'
        ? 'Select a sheet viewport or documentation item to edit placement, crop, identity, and review context.'
        : mode === '3d'
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

function InspectorDisciplineScope({
  element,
  activeWorkspaceId,
}: {
  element: Element;
  activeWorkspaceId: 'arch' | 'struct' | 'mep';
}): JSX.Element | null {
  const target =
    activeWorkspaceId === 'struct'
      ? 'structure'
      : activeWorkspaceId === 'mep'
        ? 'mep'
        : activeWorkspaceId === 'arch'
          ? 'architecture'
          : null;
  const elementDiscipline =
    'discipline' in element && typeof element.discipline === 'string' ? element.discipline : null;
  if (!target || !elementDiscipline) return null;
  const inScope = elementDiscipline === target;
  return (
    <div
      className="mb-2 rounded border border-border bg-surface-strong p-2 text-[11px]"
      data-testid="inspector-discipline-scope"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-foreground">Discipline</span>
        <span className={inScope ? 'text-foreground' : 'text-muted'}>{elementDiscipline}</span>
      </div>
      {!inScope ? (
        <div className="mt-1 leading-snug text-muted">
          Outside the active workspace scope; edits remain available to admins.
        </div>
      ) : null}
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
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
}: {
  el: Extract<Element, { kind: 'column' }>;
  onSemanticCommand: (cmd: Record<string, unknown>) => void | Promise<void>;
  t: ReturnType<typeof useTranslation>['t'];
  onOpenMaterialBrowser?: (target?: MaterialBrowserTargetRequest) => void;
  onOpenAppearanceAssetBrowser?: (target?: MaterialBrowserTargetRequest) => void;
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
        onOpenMaterialBrowser,
        onOpenAppearanceAssetBrowser,
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
