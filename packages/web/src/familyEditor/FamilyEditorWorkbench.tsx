import { useMemo, useState, type DragEvent, type JSX, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element, FamilyBlend, FamilyExtrusion, FamilySweep } from '@bim-ai/core';
import { FamilyParameterPanel } from '../workspace/FamilyParameterPanel';
import type {
  ArrayGeometryNode,
  FamilyDefinition,
  FamilyInstanceRefNode,
  SketchLine,
  SweepParametricProfile,
  SweepGeometryNode,
  VisibilityBinding,
  VisibilityByDetailLevel,
  VisibilityByViewType,
} from '../families/types';
import { sweepIntersectsPlanCut } from '../families/familyResolver';
import { validateFormula } from '../lib/expressionEvaluator';
import { BUILT_IN_FAMILIES } from '../families/familyCatalog';
import { LoadedFamiliesSidebar, NESTED_FAMILY_DRAG_TYPE } from './LoadedFamiliesSidebar';
import { NestedInstanceInspector, type HostParamRef } from './NestedInstanceInspector';
import { AppearanceAssetBrowserDialog } from './AppearanceAssetBrowserDialog';
import {
  pickedFamilyGeometryLine,
  pickedReferencePlaneLine,
  rederiveLockedSketchLines,
  solveReferencePlaneDimensionConstraints,
  trimExtendSketchLinesToCorner,
} from './familySketchGeometry';
import { MaterialBrowserDialog } from './MaterialBrowserDialog';
import {
  authoredFamilyDefinitionsFromElements,
  buildAuthoredFamilyDefinition,
  collectNestedFamilyDependencies,
  expandFamilyDefinitionsWithNestedDependencies,
  planAuthoredFamilyLoad,
  readAuthoredFamilyCatalog,
  upsertAuthoredFamilyCatalogDocument,
  writeAuthoredFamilyCatalog,
  type AuthoredFamilyDocument,
  type AuthoredFamilyLoadPlan,
  type AuthoredFamilyTemplate,
  type AuthoredFamilyTemplateHostType,
} from './familyEditorPersistence';
import {
  FAMILY_TEMPLATE_BROWSER_ENTRIES,
  buildFamilyTemplateMetadata,
  filterFamilyTemplateBrowserEntries,
  getFamilyTemplateBrowserEntry,
} from './familyTemplateCatalog';
import type { FamilyReloadOverwriteOption } from '../families/catalogFamilyReload';
import { FAMILY_CATEGORIES } from './familyCategories';
import { FamilyEditorAlignedDimensionsSection } from './FamilyEditorAlignedDimensionsSection';
import { FamilyEditorParametersSection } from './FamilyEditorParametersSection';
import {
  ArrayDraftPanel,
  FamilyTypesDialog,
  MaterialDefaultEditor,
  SweepPathSketch,
  SweepProfileSketch,
} from './FamilyEditorWorkbenchPanels';
import {
  FAMILY_VISIBILITY_VIEW_TYPES,
  SYMBOLIC_LINE_OBJECT_STYLES,
  SweepPropertiesPanel,
  SymbolicLinePropertiesPanel,
  type DetailLevelKey,
  type PreviewViewTypeKey,
  type SymbolicLine,
  type SymbolicLineSubcategory,
} from './FamilyEditorPropertiesPanels';
import {
  DEFAULT_CATEGORY_SETTINGS,
  DEFAULT_FAMILY_TYPE_ID,
  DEFAULT_FAMILY_VIEW_RANGE,
  EMPTY_ARRAY_DRAFT,
  EMPTY_CANVAS_ALIGN_DRAFT,
  EMPTY_MIRROR_DRAFT,
  EMPTY_SWEEP_DRAFT,
  EMPTY_SYMBOLIC_ALIGN_DRAFT,
  EMPTY_SYMBOLIC_LINE_DRAFT,
  FURNITURE_PARAMS,
  FURNITURE_REF_PLANES,
  FURNITURE_SWEEPS,
  FURNITURE_SYMBOLIC_LINES,
  FURNITURE_TYPE_ROWS,
  applyEqConstraintToPlanes,
  arrayDraftToNode,
  circularProfileLines,
  equalGapForPlanes,
  initialFamilyTypeRows,
  resolveFamilyParamValue,
  type ArrayDraft,
  type EqConstraint,
  type FamilyCategory,
  type FamilyCategorySettings,
  type FamilyDimension,
  type FamilyTypeRow,
  type FamilyViewRange,
  type MaterialAssignmentTarget,
  type Param,
  type RefPlane,
  type SweepDraft,
} from './familyEditorWorkbenchDefaults';

type Template = AuthoredFamilyTemplate;
type SizedFamilyExtrusion = FamilyExtrusion & {
  widthMm?: number;
  heightMm?: number;
};

export { resolveFamilyParamValue };

const SKETCH_REF_EXTENT_MM = 1000;

/**
 * FAM-01 — placement payload yielded by the Loaded Families sidebar's
 * drag-drop / click-to-add affordance. Pure-data shape so tests can
 * assert against `addNestedFamilyInstance` without driving the DOM.
 */
export interface AddNestedFamilyInstanceAction {
  type: 'addNestedFamilyInstance';
  familyId: string;
  positionMm: { xMm: number; yMm: number; zMm: number };
}

export interface FamilyEditorWorkbenchProps {
  projectElementsById?: Record<string, Element>;
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  now?: () => number;
  onLoadIntoProject?: (plan: AuthoredFamilyLoadPlan) => void | Promise<void>;
  onSemanticCommand?: (cmd: Record<string, unknown>) => void;
}

export function FamilyEditorWorkbench({
  projectElementsById = {},
  storage,
  now = () => Date.now(),
  onLoadIntoProject,
  onSemanticCommand,
}: FamilyEditorWorkbenchProps = {}): JSX.Element {
  const { t } = useTranslation();
  const effectiveStorage =
    storage === undefined && typeof globalThis.localStorage !== 'undefined'
      ? globalThis.localStorage
      : storage;
  const [familyId, setFamilyId] = useState('authored-family-1');
  const [familyName, setFamilyName] = useState('Untitled Family');
  const [savedFamilies, setSavedFamilies] = useState<AuthoredFamilyDocument[]>(() =>
    readAuthoredFamilyCatalog(effectiveStorage),
  );
  const [localProjectFamilyTypes, setLocalProjectFamilyTypes] = useState<
    Record<string, Extract<Element, { kind: 'family_type' }>>
  >({});
  const [persistenceMessage, setPersistenceMessage] = useState('');
  const [pendingLoadPlan, setPendingLoadPlan] = useState<AuthoredFamilyLoadPlan | null>(null);
  const [template, setTemplate] = useState<Template>('generic_model');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateHostFilter, setTemplateHostFilter] = useState<
    AuthoredFamilyTemplateHostType | 'all'
  >('all');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<FamilyCategory | 'all'>(
    'all',
  );
  const [refPlanes, setRefPlanes] = useState<RefPlane[]>([]);
  const [params, setParams] = useState<Param[]>([]);
  const [familyTypes, setFamilyTypes] = useState<FamilyTypeRow[]>(() => initialFamilyTypeRows());
  const [activeFamilyTypeId, setActiveFamilyTypeId] = useState(DEFAULT_FAMILY_TYPE_ID);
  const [familyTypesDialogOpen, setFamilyTypesDialogOpen] = useState(false);
  const [familyCategoryKey, setFamilyCategoryKey] = useState<string>('');
  const [categorySettings, setCategorySettings] =
    useState<FamilyCategorySettings>(DEFAULT_CATEGORY_SETTINGS);
  const [viewRange, setViewRange] = useState<FamilyViewRange>(DEFAULT_FAMILY_VIEW_RANGE);
  const [previewVisibility, setPreviewVisibility] = useState(false);
  const [previewDetailLevel, setPreviewDetailLevel] = useState<DetailLevelKey>('medium');
  const [previewViewType, setPreviewViewType] = useState<PreviewViewTypeKey>('three_d');
  const [flexMode, setFlexMode] = useState(false);
  const [flexValues, setFlexValues] = useState<Record<string, unknown>>({});
  const [sweeps, setSweeps] = useState<SweepGeometryNode[]>([]);
  const [sweepDraft, setSweepDraft] = useState<SweepDraft | null>(null);
  const [selectedSweepIndex, setSelectedSweepIndex] = useState<number | null>(null);
  const [familySweepForms, setFamilySweepForms] = useState<FamilySweep[]>([]);
  const [familyBlendForms, setFamilyBlendForms] = useState<FamilyBlend[]>([]);
  const [familyWindowFrameForms, setFamilyWindowFrameForms] = useState<FamilyExtrusion[]>([]);
  const [familyGlazingForms, setFamilyGlazingForms] = useState<FamilyExtrusion[]>([]);
  const [arrays, setArrays] = useState<ArrayGeometryNode[]>([]);
  const [arrayDraft, setArrayDraft] = useState<ArrayDraft | null>(null);
  const [symbolicLines, setSymbolicLines] = useState<SymbolicLine[]>([]);
  const [symbolicLineDraft, setSymbolicLineDraft] = useState(EMPTY_SYMBOLIC_LINE_DRAFT);
  const [selectedSymbolicLineIndex, setSelectedSymbolicLineIndex] = useState<number | null>(null);
  const [symbolicCanvasStart, setSymbolicCanvasStart] = useState<{
    xMm: number;
    yMm: number;
  } | null>(null);
  const [symbolicAlignDraft, setSymbolicAlignDraft] = useState(EMPTY_SYMBOLIC_ALIGN_DRAFT);
  const [canvasAlignDraft, setCanvasAlignDraft] = useState(EMPTY_CANVAS_ALIGN_DRAFT);
  const [mirrorDraft, setMirrorDraft] = useState(EMPTY_MIRROR_DRAFT);
  const [dimensions, setDimensions] = useState<FamilyDimension[]>([]);
  const [dimensionDraft, setDimensionDraft] = useState({
    refAId: '',
    refBId: '',
    labelMode: 'new' as 'existing' | 'new',
    paramKey: '',
    newParamKey: '',
  });
  const [eqConstraints, setEqConstraints] = useState<EqConstraint[]>([]);
  const [eqOrientation, setEqOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [eqPickMode, setEqPickMode] = useState(false);
  const [eqPickedRefIds, setEqPickedRefIds] = useState<string[]>([]);
  const [nestedInstances, setNestedInstances] = useState<FamilyInstanceRefNode[]>([]);
  const [selectedNestedIndex, setSelectedNestedIndex] = useState<number | null>(null);
  const [materialTarget, setMaterialTarget] = useState<MaterialAssignmentTarget | null>(null);
  const [appearanceTarget, setAppearanceTarget] = useState<MaterialAssignmentTarget | null>(null);
  const [lastNestedAction, setLastNestedAction] = useState<AddNestedFamilyInstanceAction | null>(
    null,
  );
  const [familyParameters, setFamilyParameters] = useState<
    Extract<Element, { kind: 'family_parameter' }>[]
  >([]);
  const [localConstraints, setLocalConstraints] = useState<
    Extract<Element, { kind: 'family_constraint' }>[]
  >([]);
  const projectFamilyElements = useMemo(
    () => ({ ...projectElementsById, ...localProjectFamilyTypes }),
    [localProjectFamilyTypes, projectElementsById],
  );
  const authoredFamilyDefinitions = useMemo(
    () =>
      expandFamilyDefinitionsWithNestedDependencies([
        ...savedFamilies.map(buildAuthoredFamilyDefinition),
        ...authoredFamilyDefinitionsFromElements(projectFamilyElements),
      ]),
    [projectFamilyElements, savedFamilies],
  );
  const availableNestedFamilyDefinitions = useMemo(
    () =>
      expandFamilyDefinitionsWithNestedDependencies([
        ...BUILT_IN_FAMILIES,
        ...authoredFamilyDefinitions,
      ]),
    [authoredFamilyDefinitions],
  );

  function addRefPlane(isVertical: boolean) {
    setRefPlanes((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: 'Ref Plane',
        isVertical,
        offsetMm: 0,
        isSymmetryRef: false,
        referenceType: 'weak_reference',
        locked: false,
      },
    ]);
  }

  function currentParamValueMap(
    paramList = params,
    activeTypeValuesOverride?: Record<string, unknown>,
  ): Record<string, unknown> {
    const activeTypeValues =
      activeTypeValuesOverride ??
      familyTypes.find((row) => row.id === activeFamilyTypeId)?.values ??
      {};
    const map: Record<string, unknown> = {};
    for (const param of paramList) {
      const typedDefault =
        activeTypeValues[param.key] !== undefined && activeTypeValues[param.key] !== ''
          ? activeTypeValues[param.key]
          : param.default;
      map[param.key] = resolveFamilyParamValue(
        { ...param, default: typedDefault },
        flexMode ? flexValues : undefined,
      );
    }
    return map;
  }

  function pickableFamilyGeometryLines(lines = symbolicLines): SketchLine[] {
    return lines.map((line) => ({
      startMm: { ...line.startMm },
      endMm: { ...line.endMm },
    }));
  }

  function solveDimensionConstrainedRefPlanes(
    planes: RefPlane[],
    dimensionList = dimensions,
    paramList = params,
    activeTypeValuesOverride?: Record<string, unknown>,
  ): RefPlane[] {
    return solveReferencePlaneDimensionConstraints(
      planes,
      dimensionList.map((dimension) => ({
        refAId: dimension.refAId,
        refBId: dimension.refBId,
        paramKey: dimension.paramKey,
        lockedValueMm: dimension.lockedValueMm,
      })),
      currentParamValueMap(paramList, activeTypeValuesOverride),
    );
  }

  function resetAuthoredFamilyContent() {
    setParams([]);
    setFamilyTypes(initialFamilyTypeRows());
    setActiveFamilyTypeId(DEFAULT_FAMILY_TYPE_ID);
    setFamilyTypesDialogOpen(false);
    setPreviewVisibility(false);
    setPreviewDetailLevel('medium');
    setPreviewViewType('three_d');
    setFlexMode(false);
    setFlexValues({});
    setSweeps([]);
    setSelectedSweepIndex(null);
    setFamilySweepForms([]);
    setFamilyBlendForms([]);
    setFamilyWindowFrameForms([]);
    setFamilyGlazingForms([]);
    setArrays([]);
    setArrayDraft(null);
    setSymbolicLines([]);
    setSymbolicLineDraft(EMPTY_SYMBOLIC_LINE_DRAFT);
    setSelectedSymbolicLineIndex(null);
    setSymbolicCanvasStart(null);
    setSymbolicAlignDraft(EMPTY_SYMBOLIC_ALIGN_DRAFT);
    setCanvasAlignDraft(EMPTY_CANVAS_ALIGN_DRAFT);
    setMirrorDraft(EMPTY_MIRROR_DRAFT);
    setDimensions([]);
    setDimensionDraft({
      refAId: '',
      refBId: '',
      labelMode: 'new',
      paramKey: '',
      newParamKey: '',
    });
    setEqConstraints([]);
    setEqOrientation('vertical');
    setEqPickMode(false);
    setEqPickedRefIds([]);
    setNestedInstances([]);
    setSelectedNestedIndex(null);
  }

  function selectTemplate(nextTemplate: Template) {
    const templateEntry = getFamilyTemplateBrowserEntry(nextTemplate);
    setTemplate(nextTemplate);
    setCategorySettings({
      category: templateEntry.category,
      alwaysVertical: templateEntry.defaultAlwaysVertical,
      workPlaneBased: templateEntry.defaultWorkPlaneBased,
      roomCalculationPoint: templateEntry.defaultRoomCalculationPoint,
      shared: templateEntry.defaultShared,
    });
    if (nextTemplate !== 'furniture') {
      setRefPlanes([]);
      setViewRange(DEFAULT_FAMILY_VIEW_RANGE);
      resetAuthoredFamilyContent();
      return;
    }
    setRefPlanes(FURNITURE_REF_PLANES.map((plane) => ({ ...plane })));
    setParams(FURNITURE_PARAMS.map((param) => ({ ...param })));
    setFamilyTypes(FURNITURE_TYPE_ROWS.map((row) => ({ ...row, values: { ...row.values } })));
    setActiveFamilyTypeId(DEFAULT_FAMILY_TYPE_ID);
    setFamilyTypesDialogOpen(false);
    setViewRange(DEFAULT_FAMILY_VIEW_RANGE);
    setPreviewVisibility(true);
    setPreviewDetailLevel('coarse');
    setFlexMode(false);
    setFlexValues({});
    setSweeps(FURNITURE_SWEEPS.map((sweep) => ({ ...sweep })));
    setSelectedSweepIndex(null);
    setArrays([]);
    setArrayDraft(null);
    setSymbolicLines(FURNITURE_SYMBOLIC_LINES.map((line) => ({ ...line })));
    setSymbolicLineDraft(EMPTY_SYMBOLIC_LINE_DRAFT);
    setSelectedSymbolicLineIndex(null);
    setSymbolicCanvasStart(null);
    setSymbolicAlignDraft(EMPTY_SYMBOLIC_ALIGN_DRAFT);
    setCanvasAlignDraft(EMPTY_CANVAS_ALIGN_DRAFT);
    setMirrorDraft(EMPTY_MIRROR_DRAFT);
    setDimensions([
      {
        id: 'dim-backrest-depth',
        refAId: 'furniture-center-front-back',
        refBId: 'furniture-backrest-depth',
        lockedValueMm: 180,
        paramKey: 'Backrest_Depth',
        canvasOffsetMm: 60,
      },
      {
        id: 'dim-leg-offset-x',
        refAId: 'furniture-center-left-right',
        refBId: 'furniture-leg-offset-x',
        lockedValueMm: 90,
        paramKey: 'Leg_Offset',
        canvasOffsetMm: 88,
      },
      {
        id: 'dim-leg-offset-y',
        refAId: 'furniture-center-front-back',
        refBId: 'furniture-leg-offset-y',
        lockedValueMm: 90,
        paramKey: 'Leg_Offset',
        canvasOffsetMm: 116,
      },
    ]);
    setDimensionDraft({
      refAId: '',
      refBId: '',
      labelMode: 'new',
      paramKey: '',
      newParamKey: '',
    });
    setEqConstraints([]);
    setEqOrientation('vertical');
    setEqPickMode(false);
    setEqPickedRefIds([]);
    setNestedInstances([]);
    setSelectedNestedIndex(null);
  }

  function currentTemplateMetadata() {
    const entry = getFamilyTemplateBrowserEntry(template);
    return buildFamilyTemplateMetadata(entry, {
      originReferencePlaneIds: refPlanes
        .filter((plane) => plane.offsetMm === 0 && plane.isSymmetryRef)
        .map((plane) => plane.id),
      referencePlaneIds: refPlanes.map((plane) => plane.id),
      defaultTypeNames: familyTypes.map((row) => row.name),
    });
  }

  function currentAuthoredFamilyDocument(): AuthoredFamilyDocument {
    const savedAt = now();
    const document: AuthoredFamilyDocument = {
      id: familyId.trim() || 'authored-family-1',
      name: familyName.trim() || 'Untitled Family',
      template,
      templateMetadata: currentTemplateMetadata(),
      categorySettings,
      viewRange,
      refPlanes: refPlanes.map((plane) => ({ ...plane })),
      params: params.map((param) => ({ ...param })),
      familyTypes: familyTypes.map((row) => ({ ...row, values: { ...row.values } })),
      activeFamilyTypeId,
      sweeps: sweeps.map((sweep) => ({ ...sweep })),
      arrays: arrays.map((array) => ({ ...array })),
      nestedInstances: nestedInstances.map((instance) => ({ ...instance })),
      symbolicLines: symbolicLines.map((line) => ({ ...line })),
      dimensions: dimensions.map((dimension) => ({ ...dimension })),
      eqConstraints: eqConstraints.map((constraint) => ({ ...constraint })),
      savedAt,
      version: `family-editor-${savedAt}`,
    };
    const nestedFamilyDefinitions = collectNestedFamilyDependencies(
      document,
      availableNestedFamilyDefinitions,
    );
    return nestedFamilyDefinitions.length ? { ...document, nestedFamilyDefinitions } : document;
  }

  function saveFamilyDocument(): AuthoredFamilyDocument {
    const document = currentAuthoredFamilyDocument();
    const nextCatalog = upsertAuthoredFamilyCatalogDocument(savedFamilies, document);
    setSavedFamilies(nextCatalog);
    writeAuthoredFamilyCatalog(nextCatalog, effectiveStorage);
    setPersistenceMessage(`Saved ${document.name}`);
    return document;
  }

  function loadFamilyDocument(documentId: string) {
    const document = savedFamilies.find((candidate) => candidate.id === documentId);
    if (!document) return;
    setFamilyId(document.id);
    setFamilyName(document.name);
    setTemplate(document.template);
    setCategorySettings(document.categorySettings);
    setViewRange(document.viewRange);
    setRefPlanes(
      document.refPlanes.map(
        (plane): RefPlane => ({
          ...plane,
          referenceType: plane.referenceType ?? 'weak_reference',
          locked: plane.locked ?? false,
        }),
      ),
    );
    setParams(
      document.params.map((param) => ({
        ...param,
        instanceOverridable: param.instanceOverridable ?? false,
      })),
    );
    setFamilyTypes(document.familyTypes.map((row) => ({ ...row, values: { ...row.values } })));
    setActiveFamilyTypeId(document.activeFamilyTypeId);
    setFamilyTypesDialogOpen(false);
    setPreviewVisibility(false);
    setPreviewDetailLevel('medium');
    setFlexMode(false);
    setFlexValues({});
    setSweeps(document.sweeps.map((sweep) => ({ ...sweep })));
    setSelectedSweepIndex(null);
    setArrays(document.arrays.map((array) => ({ ...array })));
    setArrayDraft(null);
    setSymbolicLines(document.symbolicLines.map((line) => ({ ...line })));
    setSymbolicLineDraft(EMPTY_SYMBOLIC_LINE_DRAFT);
    setSelectedSymbolicLineIndex(null);
    setSymbolicCanvasStart(null);
    setSymbolicAlignDraft(EMPTY_SYMBOLIC_ALIGN_DRAFT);
    setCanvasAlignDraft(EMPTY_CANVAS_ALIGN_DRAFT);
    setMirrorDraft(EMPTY_MIRROR_DRAFT);
    setDimensions(
      document.dimensions.map(
        (dimension, index): FamilyDimension => ({
          ...dimension,
          canvasOffsetMm: dimension.canvasOffsetMm ?? 64 + index * 28,
        }),
      ),
    );
    setDimensionDraft({
      refAId: '',
      refBId: '',
      labelMode: 'new',
      paramKey: '',
      newParamKey: '',
    });
    setEqConstraints(document.eqConstraints.map((constraint) => ({ ...constraint })));
    setEqOrientation('vertical');
    setEqPickMode(false);
    setEqPickedRefIds([]);
    setNestedInstances(document.nestedInstances.map((instance) => ({ ...instance })));
    setSelectedNestedIndex(null);
    setPersistenceMessage(`Opened ${document.name}`);
  }

  async function applyAuthoredFamilyLoadPlan(plan: AuthoredFamilyLoadPlan) {
    if (onLoadIntoProject) {
      await onLoadIntoProject(plan);
    } else {
      setLocalProjectFamilyTypes((prev) => {
        const next = { ...prev };
        for (const command of plan.commands) {
          next[command.id] = {
            kind: 'family_type',
            id: command.id,
            name: command.name,
            familyId: command.familyId,
            discipline: command.discipline,
            parameters: command.parameters,
          };
        }
        return next;
      });
    }
    setPersistenceMessage(
      plan.reloaded
        ? `Reloaded ${familyName.trim() || 'Untitled Family'} into project`
        : `Loaded ${familyName.trim() || 'Untitled Family'} into project`,
    );
  }

  async function loadFamilyIntoProject(overwriteOption?: FamilyReloadOverwriteOption) {
    const document = saveFamilyDocument();
    const plan = planAuthoredFamilyLoad(document, projectFamilyElements, {
      now: now(),
      overwriteOption,
    });
    if (plan.reloaded && !overwriteOption) {
      setPendingLoadPlan(plan);
      return;
    }
    await applyAuthoredFamilyLoadPlan(plan);
  }

  function updateRefPlane(index: number, patch: Partial<RefPlane>) {
    const patched = refPlanes.map((plane, i) => (i === index ? { ...plane, ...patch } : plane));
    const equalized = eqConstraints.reduce(applyEqConstraintToPlanes, patched);
    const next = solveDimensionConstrainedRefPlanes(equalized);
    setRefPlanes(next);
    setEqConstraints((prev) =>
      prev.map((constraint) => ({
        ...constraint,
        equalGapMm: equalGapForPlanes(next, constraint.refPlaneIds),
      })),
    );
    const nextSymbolicLines = symbolicLines.map((line) => {
      const lockedPlaneId = line.alignmentLock?.refPlaneId;
      if (!lockedPlaneId) return line;
      const plane = next.find((candidate) => candidate.id === lockedPlaneId);
      return plane ? alignSymbolicLineToPlane(line, plane, true) : line;
    });
    const nextPickableLines = pickableFamilyGeometryLines(nextSymbolicLines);
    setSweepDraft((draft) =>
      draft
        ? {
            ...draft,
            pathLines: rederiveLockedSketchLines(
              draft.pathLines,
              next,
              nextPickableLines,
              SKETCH_REF_EXTENT_MM,
            ),
            profile: rederiveLockedSketchLines(
              draft.profile,
              next,
              nextPickableLines,
              SKETCH_REF_EXTENT_MM,
            ),
          }
        : draft,
    );
    setSymbolicLines(nextSymbolicLines);
  }

  function createEqConstraintForRefIds(refPlaneIds: string[]) {
    const selected = refPlaneIds
      .map((id) => refPlanes.find((plane) => plane.id === id))
      .filter((plane): plane is RefPlane => Boolean(plane))
      .sort((a, b) => a.offsetMm - b.offsetMm);
    if (selected.length < 3) return;
    if (!selected.every((plane) => plane.isVertical === selected[0]!.isVertical)) return;
    const selectedIds = selected.map((plane) => plane.id);
    const constraint: EqConstraint = {
      id: `eq-${eqConstraints.length + 1}`,
      orientation: selected[0]!.isVertical ? 'vertical' : 'horizontal',
      refPlaneIds: selectedIds,
      equalGapMm: equalGapForPlanes(refPlanes, selectedIds),
    };
    const next = applyEqConstraintToPlanes(refPlanes, constraint);
    setRefPlanes(next);
    setEqConstraints((prev) => [
      ...prev,
      { ...constraint, equalGapMm: equalGapForPlanes(next, selectedIds) },
    ]);
    setEqPickedRefIds([]);
    setEqPickMode(false);
  }

  function createEqConstraint() {
    const isVertical = eqOrientation === 'vertical';
    createEqConstraintForRefIds(
      refPlanes
        .filter((plane) => plane.isVertical === isVertical)
        .sort((a, b) => a.offsetMm - b.offsetMm)
        .map((plane) => plane.id),
    );
  }

  function createPickedEqConstraint() {
    createEqConstraintForRefIds(eqPickedRefIds);
  }

  function toggleEqPickedRef(planeId: string) {
    if (!eqPickMode) return;
    setEqPickedRefIds((prev) =>
      prev.includes(planeId) ? prev.filter((id) => id !== planeId) : [...prev, planeId],
    );
  }

  function removeEqConstraint(id: string) {
    setEqConstraints((prev) => prev.filter((constraint) => constraint.id !== id));
  }

  function refPlaneDistanceMm(refAId: string, refBId: string): number {
    const a = refPlanes.find((plane) => plane.id === refAId);
    const b = refPlanes.find((plane) => plane.id === refBId);
    if (!a || !b) return 0;
    return Math.abs(a.offsetMm - b.offsetMm);
  }

  function createDimensionParameter() {
    const refAId = dimensionDraft.refAId || refPlanes[0]?.id || '';
    const refBId = dimensionDraft.refBId || refPlanes[1]?.id || '';
    if (!refAId || !refBId || refAId === refBId) return;
    const paramKey =
      dimensionDraft.labelMode === 'existing'
        ? (
            dimensionDraft.paramKey ||
            params.find((param) => param.type === 'length_mm')?.key ||
            ''
          ).trim()
        : (dimensionDraft.newParamKey || `dimension_${dimensions.length + 1}`).trim();
    if (!paramKey) return;
    const lockedValueMm = refPlaneDistanceMm(refAId, refBId);
    const nextDimensions = [
      ...dimensions,
      {
        id: `dim-${dimensions.length + 1}`,
        refAId,
        refBId,
        lockedValueMm,
        paramKey,
        canvasOffsetMm: 64 + dimensions.length * 28,
      },
    ];
    const shouldCreateParam =
      dimensionDraft.labelMode === 'new' && !params.some((param) => param.key === paramKey);
    const nextParams = shouldCreateParam
      ? [
          ...params,
          {
            key: paramKey,
            label: paramKey,
            type: 'length_mm' as const,
            default: lockedValueMm,
            formula: '',
            instanceOverridable: false,
          },
        ]
      : params;
    setDimensions(nextDimensions);
    setParams(nextParams);
    setRefPlanes((prev) => solveDimensionConstrainedRefPlanes(prev, nextDimensions, nextParams));
    setDimensionDraft((prev) => ({
      ...prev,
      paramKey: '',
      newParamKey: '',
      labelMode: shouldCreateParam ? 'new' : prev.labelMode,
    }));
  }

  function updateDimensionLabel(dimensionId: string, paramKey: string) {
    const nextDimensions = dimensions.map((dimension) =>
      dimension.id === dimensionId ? { ...dimension, paramKey } : dimension,
    );
    setDimensions(nextDimensions);
    setRefPlanes((prev) => solveDimensionConstrainedRefPlanes(prev, nextDimensions));
  }

  function addParam() {
    setParams((prev) => [
      ...prev,
      {
        key: `param_${prev.length + 1}`,
        label: '',
        type: 'length_mm',
        default: 0,
        formula: '',
        instanceOverridable: false,
      },
    ]);
  }

  function ensureParam(nextParam: Param): string {
    const key = nextParam.key.trim();
    if (!key) return nextParam.key;
    setParams((prev) =>
      prev.some((param) => param.key === key)
        ? prev
        : [
            ...prev,
            {
              ...nextParam,
              key,
              label: nextParam.label || key,
            },
          ],
    );
    return key;
  }

  function ensureBooleanParam(key = 'Show_2D_Elements', label = 'Show 2D Elements'): string {
    return ensureParam({
      key,
      label,
      type: 'boolean',
      default: true,
      formula: '',
      instanceOverridable: true,
    });
  }

  function firstBooleanParamKey(): string {
    return params.find((param) => param.type === 'boolean')?.key ?? ensureBooleanParam();
  }

  function ensureLengthParam(key: string, label: string, defaultMm: number): string {
    return ensureParam({
      key,
      label,
      type: 'length_mm',
      default: defaultMm,
      formula: '',
      instanceOverridable: false,
    });
  }

  function updateParam(index: number, patch: Partial<Param>) {
    setParams((prev) => {
      const next = prev.map((p, i) => (i === index ? { ...p, ...patch } : p));
      setRefPlanes((planes) => solveDimensionConstrainedRefPlanes(planes, dimensions, next));
      return next;
    });
  }

  function upsertFamilyTypeRow(row: FamilyTypeRow) {
    setFamilyTypes((prev) => prev.map((candidate) => (candidate.id === row.id ? row : candidate)));
    if (row.id === activeFamilyTypeId) {
      setRefPlanes((planes) =>
        solveDimensionConstrainedRefPlanes(planes, dimensions, params, row.values),
      );
    }
  }

  function createFamilyTypeRow() {
    setFamilyTypes((prev) => {
      const base =
        prev.find((row) => row.id === activeFamilyTypeId) ?? prev[0] ?? initialFamilyTypeRows()[0]!;
      const nextId = `family-type-${prev.length + 1}`;
      const row: FamilyTypeRow = {
        id: nextId,
        name: `${base.name} Copy`,
        values: { ...base.values },
      };
      setActiveFamilyTypeId(nextId);
      return [...prev, row];
    });
  }

  function deleteFamilyTypeRow(id: string) {
    setFamilyTypes((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((row) => row.id !== id);
      if (activeFamilyTypeId === id) {
        setActiveFamilyTypeId(next[0]?.id ?? DEFAULT_FAMILY_TYPE_ID);
      }
      return next;
    });
  }

  function setFlexValue(key: string, raw: string) {
    setFlexValues((prev) => {
      if (raw === '') {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      const numeric = Number(raw);
      const value: unknown = Number.isFinite(numeric) ? numeric : raw;
      return { ...prev, [key]: value };
    });
  }

  function toggleFlexMode() {
    setFlexMode((prev) => {
      const next = !prev;
      // Exiting flex mode discards flex values; defaults are unchanged.
      if (!next) setFlexValues({});
      return next;
    });
  }

  function resetFlexValues() {
    setFlexValues({});
  }

  function startSweep() {
    setSweepDraft({ ...EMPTY_SWEEP_DRAFT });
  }

  function appendSweepPathLine(line: SketchLine) {
    setSweepDraft((prev) => (prev ? { ...prev, pathLines: [...prev.pathLines, line] } : prev));
  }

  function appendSweepProfileLine(line: SketchLine) {
    setSweepDraft((prev) =>
      prev
        ? {
            ...prev,
            profile: [...prev.profile, line],
            parametricProfile: undefined,
            copiedCircleProfiles: undefined,
          }
        : prev,
    );
  }

  function appendSweepProfileCircle(
    centerXMm: number,
    centerYMm: number,
    radiusMm: number,
    radiusParam: string,
  ) {
    const safeRadius = Math.max(1, Math.round(radiusMm));
    const profile: SweepParametricProfile = {
      kind: 'circle',
      centerX: centerXMm,
      centerY: centerYMm,
      radiusParam,
      fallbackRadiusMm: safeRadius,
      segments: 24,
      editablePrimitive: 'circle',
    };
    setSweepDraft((prev) =>
      prev
        ? {
            ...prev,
            profile: circularProfileLines(centerXMm, centerYMm, safeRadius, 24),
            parametricProfile: profile,
            copiedCircleProfiles: [],
          }
        : prev,
    );
  }

  function copySweepProfileCircle(dxMm: number, dyMm: number) {
    setSweepDraft((prev) => {
      if (!prev?.parametricProfile || prev.parametricProfile.kind !== 'circle') return prev;
      const base = prev.parametricProfile;
      const baseX =
        typeof base.centerX === 'number' ? base.centerX : (base.centerX.fallbackMm ?? 0);
      const baseY =
        typeof base.centerY === 'number' ? base.centerY : (base.centerY.fallbackMm ?? 0);
      const radius = base.fallbackRadiusMm ?? 25;
      const copiedCenterX = Math.round(baseX + dxMm);
      const copiedCenterY = Math.round(baseY + dyMm);
      const profile: SweepParametricProfile = {
        ...base,
        centerX: copiedCenterX,
        centerY: copiedCenterY,
      };
      return {
        ...prev,
        profile: [
          ...prev.profile,
          ...circularProfileLines(copiedCenterX, copiedCenterY, radius, base.segments ?? 24),
        ],
        copiedCircleProfiles: [
          ...(prev.copiedCircleProfiles ?? []),
          {
            profile,
            lines: circularProfileLines(copiedCenterX, copiedCenterY, radius, base.segments ?? 24),
          },
        ],
      };
    });
  }

  function appendPickedProfileRefPlane(planeId: string, locked: boolean) {
    const plane = refPlanes.find((candidate) => candidate.id === planeId);
    if (!plane) return;
    appendSweepProfileLine(pickedReferencePlaneLine(plane, locked, SKETCH_REF_EXTENT_MM));
  }

  function appendPickedProfileFamilyGeometry(index: number, locked: boolean) {
    const line = pickableFamilyGeometryLines()[index];
    if (!line) return;
    appendSweepProfileLine(
      pickedFamilyGeometryLine(
        line,
        { kind: 'family_geometry', geometryKind: 'symbolic_line', index },
        locked,
      ),
    );
  }

  function trimExtendProfileLines(firstIndex: number, secondIndex: number) {
    setSweepDraft((prev) =>
      prev
        ? {
            ...prev,
            profile: trimExtendSketchLinesToCorner(prev.profile, firstIndex, secondIndex),
          }
        : prev,
    );
  }

  function advanceSweepToProfile() {
    setSweepDraft((prev) => (prev ? { ...prev, step: 'profile' } : prev));
  }

  function finishSweep() {
    setSweepDraft((prev) => {
      if (!prev) return prev;
      if (prev.pathLines.length < 1 || prev.profile.length < 3) {
        // Refuse to finish degenerate sweeps; user has to add geometry first.
        return prev;
      }
      const node: SweepGeometryNode = {
        kind: 'sweep',
        pathLines: prev.pathLines,
        profile: prev.profile,
        profilePlane: prev.profilePlane,
        ...(prev.parametricProfile ? { parametricProfile: prev.parametricProfile } : {}),
      };
      const copiedNodes: SweepGeometryNode[] = (prev.copiedCircleProfiles ?? []).map((copy) => ({
        kind: 'sweep',
        pathLines: prev.pathLines,
        profile: copy.lines,
        profilePlane: prev.profilePlane,
        parametricProfile: copy.profile,
      }));
      setSweeps((s) => [...s, node, ...copiedNodes]);
      return null;
    });
  }

  function cancelSweep() {
    setSweepDraft(null);
  }

  function addFamilySweepForm() {
    setFamilySweepForms((prev) => [
      ...prev,
      {
        kind: 'family_sweep',
        id: crypto.randomUUID(),
        profilePoints: [
          { x: -100, y: -100 },
          { x: 100, y: -100 },
          { x: 0, y: 100 },
        ],
        pathPoints: [
          { x: 0, y: 0, z: 0 },
          { x: 500, y: 0, z: 500 },
          { x: 1000, y: 0, z: 0 },
        ],
      },
    ]);
  }

  function addFamilyBlendForm() {
    setFamilyBlendForms((prev) => [
      ...prev,
      {
        kind: 'family_blend',
        id: crypto.randomUUID(),
        bottomProfilePoints: [
          { x: -500, y: -500 },
          { x: 500, y: -500 },
          { x: 500, y: 500 },
          { x: -500, y: 500 },
        ],
        topProfilePoints: [
          { x: -250, y: -250 },
          { x: 250, y: -250 },
          { x: 250, y: 250 },
          { x: -250, y: 250 },
        ],
        heightMm: 1000,
      },
    ]);
  }

  function addWindowFrameForm() {
    setFamilyWindowFrameForms((prev) => [
      ...prev,
      {
        kind: 'family_extrusion',
        id: crypto.randomUUID(),
        profilePoints: [],
        depthMm: 100,
        frameInnerWidthMm: 50,
        widthMm: 900,
        heightMm: 1200,
      } as unknown as FamilyExtrusion,
    ]);
  }

  function addGlazingPanelForm() {
    setFamilyGlazingForms((prev) => [
      ...prev,
      {
        kind: 'family_extrusion',
        id: crypto.randomUUID(),
        profilePoints: [],
        depthMm: 6,
        isGlazing: true,
        widthMm: 800,
        heightMm: 1100,
      } as unknown as FamilyExtrusion,
    ]);
  }

  function updateSweepVisibility(index: number, binding: VisibilityBinding | undefined) {
    setSweeps((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        if (binding === undefined) {
          // Strip the field rather than carrying `undefined` on the node.
          const { visibilityBinding: _omit, ...rest } = s;
          return rest as SweepGeometryNode;
        }
        return { ...s, visibilityBinding: binding };
      }),
    );
  }

  function updateSweepDetailLevelVisibility(
    index: number,
    level: DetailLevelKey,
    visible: boolean,
  ) {
    setSweeps((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const next: VisibilityByDetailLevel = { ...(s.visibilityByDetailLevel ?? {}) };
        next[level] = visible;
        return { ...s, visibilityByDetailLevel: next };
      }),
    );
  }

  function updateSweepViewTypeVisibility(
    index: number,
    viewType: PreviewViewTypeKey,
    visible: boolean,
  ) {
    setSweeps((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        const next: VisibilityByViewType = { ...(s.visibilityByViewType ?? {}) };
        next[viewType] = visible;
        return { ...s, visibilityByViewType: next };
      }),
    );
  }

  function updateSweepMaterial(index: number, materialKey: string | null) {
    setSweeps((prev) =>
      prev.map((sweep, i) => {
        if (i !== index) return sweep;
        if (!materialKey) {
          const { materialKey: _omit, ...rest } = sweep;
          return rest as SweepGeometryNode;
        }
        return { ...sweep, materialKey };
      }),
    );
  }

  function updateSweepPathLengthParam(index: number, paramName: string | null) {
    setSweeps((prev) =>
      prev.map((sweep, i) => {
        if (i !== index) return sweep;
        if (!paramName) {
          const { pathLengthParam: _omit, ...rest } = sweep;
          return rest as SweepGeometryNode;
        }
        return { ...sweep, pathLengthParam: paramName };
      }),
    );
  }

  function updateSweepPathStartOffsetParam(index: number, paramName: string | null) {
    setSweeps((prev) =>
      prev.map((sweep, i) => {
        if (i !== index) return sweep;
        if (!paramName) {
          const { pathStartOffsetParam: _omit, ...rest } = sweep;
          return rest as SweepGeometryNode;
        }
        return { ...sweep, pathStartOffsetParam: paramName };
      }),
    );
  }

  function updateSweepPathEndOffsetParam(index: number, paramName: string | null) {
    setSweeps((prev) =>
      prev.map((sweep, i) => {
        if (i !== index) return sweep;
        if (!paramName) {
          const { pathEndOffsetParam: _omit, ...rest } = sweep;
          return rest as SweepGeometryNode;
        }
        return { ...sweep, pathEndOffsetParam: paramName };
      }),
    );
  }

  function updateSweepMaterialParam(index: number, paramName: string | null) {
    setSweeps((prev) =>
      prev.map((sweep, i) => {
        if (i !== index) return sweep;
        if (!paramName) {
          const { materialKeyParam: _omit, ...rest } = sweep;
          return rest as SweepGeometryNode;
        }
        return { ...sweep, materialKeyParam: paramName };
      }),
    );
  }

  function assignMaterial(target: MaterialAssignmentTarget, materialKey: string) {
    if (target.kind === 'param') {
      updateParam(target.index, { default: materialKey });
    } else {
      updateSweepMaterial(target.index, materialKey);
    }
  }

  function materialKeyForTarget(target: MaterialAssignmentTarget | null): string | null {
    if (!target) return null;
    if (target.kind === 'param') {
      const value = params[target.index]?.default;
      return typeof value === 'string' ? value : null;
    }
    return sweeps[target.index]?.materialKey ?? null;
  }

  function startArray() {
    setArrayDraft({ ...EMPTY_ARRAY_DRAFT });
  }

  function updateArrayDraft(patch: Partial<ArrayDraft>) {
    setArrayDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function finishArray() {
    setArrayDraft((prev) => {
      if (!prev) return prev;
      // Refuse degenerate arrays — must have a target + a count parameter.
      if (!prev.targetFamilyId || !prev.countParam) return prev;
      if (prev.spacingMode === 'fit_total' && !prev.totalLengthParam) return prev;
      const node = arrayDraftToNode(prev);
      setArrays((s) => [...s, node]);
      return null;
    });
  }

  function cancelArray() {
    setArrayDraft(null);
  }

  function addSymbolicLine() {
    setSymbolicLines((prev) => [
      ...prev,
      {
        startMm: { xMm: symbolicLineDraft.sx, yMm: symbolicLineDraft.sy },
        endMm: { xMm: symbolicLineDraft.ex, yMm: symbolicLineDraft.ey },
        subcategory: symbolicLineDraft.subcategory,
      },
    ]);
    setSelectedSymbolicLineIndex(symbolicLines.length);
  }

  function updateSymbolicLineVisibility(index: number, binding: VisibilityBinding | undefined) {
    setSymbolicLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        if (binding === undefined) {
          const { visibilityBinding: _omit, ...rest } = line;
          return rest as SymbolicLine;
        }
        return { ...line, visibilityBinding: binding };
      }),
    );
  }

  function updateSymbolicLineDetailLevelVisibility(
    index: number,
    level: DetailLevelKey,
    visible: boolean,
  ) {
    setSymbolicLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next: VisibilityByDetailLevel = { ...(line.visibilityByDetailLevel ?? {}) };
        next[level] = visible;
        return { ...line, visibilityByDetailLevel: next };
      }),
    );
  }

  function updateSymbolicLineViewTypeVisibility(
    index: number,
    viewType: PreviewViewTypeKey,
    visible: boolean,
  ) {
    setSymbolicLines((prev) =>
      prev.map((line, i) => {
        if (i !== index) return line;
        const next: VisibilityByViewType = { ...(line.visibilityByViewType ?? {}) };
        next[viewType] = visible;
        return { ...line, visibilityByViewType: next };
      }),
    );
  }

  function canvasPointFromMouseEvent(event: MouseEvent<SVGSVGElement>): {
    xMm: number;
    yMm: number;
  } {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width || 480;
    const height = rect.height || 260;
    const scale = 5;
    return {
      xMm: Math.round((event.clientX - rect.left - width / 2) * scale),
      yMm: Math.round((height / 2 - (event.clientY - rect.top)) * scale),
    };
  }

  function drawSymbolicLineOnCanvas(event: MouseEvent<SVGSVGElement>) {
    const point = canvasPointFromMouseEvent(event);
    if (mirrorDraft.active) {
      if (!mirrorDraft.axisStart) {
        setMirrorDraft((prev) => ({ ...prev, axisStart: point }));
        return;
      }
      mirrorSelectedSymbolicLine(mirrorDraft.axisStart, point, mirrorDraft.copy);
      setMirrorDraft((prev) => ({ ...prev, active: false, axisStart: null }));
      return;
    }
    if (!symbolicCanvasStart) {
      setSymbolicCanvasStart(point);
      return;
    }
    const nextLine: SymbolicLine = {
      startMm: symbolicCanvasStart,
      endMm: point,
      subcategory: symbolicLineDraft.subcategory,
    };
    setSymbolicLines((prev) => {
      setSelectedSymbolicLineIndex(prev.length);
      return [...prev, nextLine];
    });
    setSymbolicLineDraft((prev) => ({
      ...prev,
      sx: symbolicCanvasStart.xMm,
      sy: symbolicCanvasStart.yMm,
      ex: point.xMm,
      ey: point.yMm,
    }));
    setSymbolicCanvasStart(null);
  }

  function canvasCoord(point: { xMm: number; yMm: number }): { x: number; y: number } {
    return { x: 240 + point.xMm / 5, y: 130 - point.yMm / 5 };
  }

  function mirrorPointAcrossAxis(
    point: { xMm: number; yMm: number },
    axisStart: { xMm: number; yMm: number },
    axisEnd: { xMm: number; yMm: number },
  ): { xMm: number; yMm: number } {
    const ax = axisStart.xMm;
    const ay = axisStart.yMm;
    const bx = axisEnd.xMm;
    const by = axisEnd.yMm;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq <= 0) return point;
    const t = ((point.xMm - ax) * dx + (point.yMm - ay) * dy) / lenSq;
    const px = ax + t * dx;
    const py = ay + t * dy;
    return {
      xMm: Math.round(2 * px - point.xMm),
      yMm: Math.round(2 * py - point.yMm),
    };
  }

  function mirroredSymbolicLine(
    line: SymbolicLine,
    axisStart: { xMm: number; yMm: number },
    axisEnd: { xMm: number; yMm: number },
  ): SymbolicLine {
    const { alignmentLock: _lock, ...rest } = line;
    return {
      ...rest,
      startMm: mirrorPointAcrossAxis(line.startMm, axisStart, axisEnd),
      endMm: mirrorPointAcrossAxis(line.endMm, axisStart, axisEnd),
    };
  }

  function mirrorSelectedSymbolicLine(
    axisStart: { xMm: number; yMm: number },
    axisEnd: { xMm: number; yMm: number },
    copy: boolean,
  ) {
    if (selectedSymbolicLineIndex === null) return;
    setSymbolicLines((prev) => {
      const line = prev[selectedSymbolicLineIndex];
      if (!line) return prev;
      const mirrored = mirroredSymbolicLine(line, axisStart, axisEnd);
      if (copy) {
        setSelectedSymbolicLineIndex(prev.length);
        return [...prev, mirrored];
      }
      return prev.map((candidate, index) =>
        index === selectedSymbolicLineIndex ? mirrored : candidate,
      );
    });
  }

  function alignSymbolicLineToPlane(
    line: SymbolicLine,
    plane: RefPlane,
    locked: boolean,
  ): SymbolicLine {
    const nextLine = plane.isVertical
      ? {
          ...line,
          startMm: { ...line.startMm, xMm: plane.offsetMm },
          endMm: { ...line.endMm, xMm: plane.offsetMm },
        }
      : {
          ...line,
          startMm: { ...line.startMm, yMm: plane.offsetMm },
          endMm: { ...line.endMm, yMm: plane.offsetMm },
        };
    if (!locked) {
      const { alignmentLock: _omit, ...rest } = nextLine;
      return rest as SymbolicLine;
    }
    return { ...nextLine, alignmentLock: { refPlaneId: plane.id } };
  }

  function alignSelectedSymbolicLine() {
    const line = symbolicLines[symbolicAlignDraft.lineIndex];
    const refPlaneId = symbolicAlignDraft.refPlaneId || refPlanes[0]?.id || '';
    const plane = refPlanes.find((candidate) => candidate.id === refPlaneId);
    if (!line || !plane) return;
    setSymbolicLines((prev) =>
      prev.map((candidate, index) =>
        index === symbolicAlignDraft.lineIndex
          ? alignSymbolicLineToPlane(candidate, plane, symbolicAlignDraft.locked)
          : candidate,
      ),
    );
  }

  function alignCanvasSymbolicLine(index: number) {
    if (!canvasAlignDraft.active || !canvasAlignDraft.refPlaneId) return;
    const plane = refPlanes.find((candidate) => candidate.id === canvasAlignDraft.refPlaneId);
    if (!plane) return;
    setSymbolicLines((prev) =>
      prev.map((candidate, lineIndex) =>
        lineIndex === index
          ? alignSymbolicLineToPlane(candidate, plane, canvasAlignDraft.locked)
          : candidate,
      ),
    );
    setSelectedSymbolicLineIndex(index);
    setCanvasAlignDraft((prev) => ({ ...prev, active: false, refPlaneId: '' }));
  }

  function toggleSymbolicLineLock(index: number) {
    setSymbolicLines((prev) =>
      prev.map((line, lineIndex) => {
        if (lineIndex !== index || !line.alignmentLock) return line;
        const { alignmentLock: _omit, ...rest } = line;
        return rest as SymbolicLine;
      }),
    );
  }

  function applyShow2DVisibilityPreset() {
    const paramName = ensureBooleanParam();
    setSymbolicLines((prev) =>
      prev.map((line) => ({
        ...line,
        visibilityBinding: { paramName, whenTrue: true },
        visibilityByDetailLevel: {
          ...(line.visibilityByDetailLevel ?? {}),
          medium: false,
          fine: false,
        },
      })),
    );
    setSweeps((prev) =>
      prev.map((sweep) => ({
        ...sweep,
        visibilityBinding: { paramName, whenTrue: false },
        visibilityByDetailLevel: { ...(sweep.visibilityByDetailLevel ?? {}), coarse: false },
      })),
    );
  }

  /* ─── FAM-01 — nested family instance authoring ──────────────────── */

  function addNestedFamilyInstance(familyId: string, dropPointMm?: { xMm: number; yMm: number }) {
    const positionMm = {
      xMm: dropPointMm?.xMm ?? 0,
      yMm: dropPointMm?.yMm ?? 0,
      zMm: 0,
    };
    const node: FamilyInstanceRefNode = {
      kind: 'family_instance_ref',
      familyId,
      positionMm,
      rotationDeg: 0,
      parameterBindings: {},
    };
    setNestedInstances((prev) => {
      const next = [...prev, node];
      setSelectedNestedIndex(next.length - 1);
      return next;
    });
    setLastNestedAction({ type: 'addNestedFamilyInstance', familyId, positionMm });
  }

  function updateNestedInstance(index: number, patch: Partial<FamilyInstanceRefNode>) {
    setNestedInstances((prev) =>
      prev.map((n, i) => {
        if (i !== index) return n;
        const merged: FamilyInstanceRefNode = { ...n, ...patch };
        // Strip undefined visibilityBinding so the node doesn't carry the field.
        if ('visibilityBinding' in patch && patch.visibilityBinding === undefined) {
          const { visibilityBinding: _omit, ...rest } = merged;
          return rest as FamilyInstanceRefNode;
        }
        if ('visibilityByViewType' in patch && patch.visibilityByViewType === undefined) {
          const { visibilityByViewType: _omit, ...rest } = merged;
          return rest as FamilyInstanceRefNode;
        }
        return merged;
      }),
    );
  }

  function onCanvasDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const familyId =
      event.dataTransfer.getData(NESTED_FAMILY_DRAG_TYPE) ||
      event.dataTransfer.getData('text/plain');
    if (!familyId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const rawX = event.clientX - rect.left - rect.width / 2;
    const rawY = rect.height / 2 - (event.clientY - rect.top);
    const xMm = Number.isFinite(rawX) ? rawX : 0;
    const yMm = Number.isFinite(rawY) ? rawY : 0;
    addNestedFamilyInstance(familyId, { xMm, yMm });
  }

  function onCanvasDragOver(event: DragEvent<HTMLDivElement>) {
    if (
      event.dataTransfer.types.includes(NESTED_FAMILY_DRAG_TYPE) ||
      event.dataTransfer.types.includes('text/plain')
    ) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  }

  // Resolved parameter values for the canvas — defaults when flex mode
  // is off, defaults-merged-with-flex-overrides when on.
  const resolved = useMemo(() => {
    const overrides = flexMode ? flexValues : undefined;
    const activeTypeValues = familyTypes.find((row) => row.id === activeFamilyTypeId)?.values ?? {};
    const map: Record<string, unknown> = {};
    for (const param of params) {
      map[param.key] = resolveFamilyParamValue(
        {
          ...param,
          default:
            activeTypeValues[param.key] !== undefined && activeTypeValues[param.key] !== ''
              ? activeTypeValues[param.key]
              : param.default,
        },
        overrides,
      );
    }
    return map;
  }, [params, flexMode, flexValues, familyTypes, activeFamilyTypeId]);

  /* ─── FAM-01 — Loaded Families filtering + usage counts ─────────── */

  const loadedFamilies: FamilyDefinition[] = useMemo(() => {
    const authored = authoredFamilyDefinitions.filter((family, index, all) => {
      if (family.id === familyId) return false;
      return all.findIndex((candidate) => candidate.id === family.id) === index;
    });
    const catalog = [...BUILT_IN_FAMILIES, ...authored];
    // Filter the catalog to families compatible with the host's
    // category. `generic_model` and `profile` host any discipline;
    // `door` / `window` hosts pull in same-discipline plus generic
    // helpers (e.g. swing-arc). Keep the rule simple: same-template
    // → same-discipline; generic templates → all families.
    if (template === 'generic_model' || template === 'profile') return catalog;
    if (template === 'furniture') {
      return catalog.filter((f) => f.discipline === 'generic');
    }
    return catalog.filter((f) => f.discipline === template || f.discipline === 'generic');
  }, [authoredFamilyDefinitions, familyId, template]);

  const usageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inst of nestedInstances) {
      counts[inst.familyId] = (counts[inst.familyId] ?? 0) + 1;
    }
    return counts;
  }, [nestedInstances]);

  const hostParamRefs: HostParamRef[] = useMemo(
    () =>
      params.map((p) => ({
        key: p.key,
        label: p.label,
        type: p.type,
      })),
    [params],
  );

  const selectedNested = selectedNestedIndex !== null ? nestedInstances[selectedNestedIndex] : null;
  const selectedNestedFamily = selectedNested
    ? (loadedFamilies.find((f) => f.id === selectedNested.familyId) ??
      BUILT_IN_FAMILIES.find((f) => f.id === selectedNested.familyId))
    : undefined;

  const visibleTemplateEntries = useMemo(
    () =>
      filterFamilyTemplateBrowserEntries(FAMILY_TEMPLATE_BROWSER_ENTRIES, {
        query: templateSearch,
        hostType: templateHostFilter,
        category: templateCategoryFilter,
      }),
    [templateCategoryFilter, templateHostFilter, templateSearch],
  );
  const selectedTemplateEntry = getFamilyTemplateBrowserEntry(template);
  const templateHostOptions = Array.from(
    new Map(FAMILY_TEMPLATE_BROWSER_ENTRIES.map((entry) => [entry.hostType, entry.hostLabel])),
  );
  const templateCategoryOptions = Array.from(
    new Map(FAMILY_TEMPLATE_BROWSER_ENTRIES.map((entry) => [entry.category, entry.categoryLabel])),
  );

  const categoryOptions: { value: FamilyCategory; label: string }[] = [
    { value: 'generic_model', label: 'Generic Models' },
    { value: 'door', label: 'Doors' },
    { value: 'window', label: 'Windows' },
    { value: 'profile', label: 'Profiles' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'detail_component', label: 'Detail Components' },
  ];

  function visibleInPreview(node: {
    visibilityBinding?: VisibilityBinding;
    visibilityByDetailLevel?: VisibilityByDetailLevel;
    visibilityByViewType?: VisibilityByViewType;
  }): boolean {
    if (!previewVisibility) return true;
    if (node.visibilityByDetailLevel?.[previewDetailLevel] === false) return false;
    if (node.visibilityByViewType?.[previewViewType] === false) return false;
    if (node.visibilityBinding) {
      return (
        Boolean(resolved[node.visibilityBinding.paramName]) === node.visibilityBinding.whenTrue
      );
    }
    return true;
  }

  function sweepVisibleInPreview(sweep: SweepGeometryNode): boolean {
    if (!visibleInPreview(sweep)) return false;
    if (!previewVisibility || previewViewType !== 'plan_rcp') return true;
    return sweepIntersectsPlanCut(
      sweep,
      resolved as Record<string, number | boolean | string>,
      viewRange,
    );
  }

  const previewVisibleSweepCount = sweeps.filter(sweepVisibleInPreview).length;
  const previewVisibleNestedCount = nestedInstances.filter(visibleInPreview).length;
  const previewVisibleSymbolicLineCount = symbolicLines.filter(visibleInPreview).length;
  const selectedSymbolicLine =
    selectedSymbolicLineIndex !== null ? symbolicLines[selectedSymbolicLineIndex] : null;
  const symbolicProjectRenderingEvidence = symbolicLines
    .map((line, index) => {
      const style = SYMBOLIC_LINE_OBJECT_STYLES[line.subcategory];
      return `L${index + 1}:${style.objectStyle}:w${style.strokeWidth}:${style.dashArray ? 'dashed' : 'solid'}`;
    })
    .join('|');
  const lengthParams = params.filter((param) => param.type === 'length_mm');
  const dimensionParamValues = currentParamValueMap();

  function dimensionDisplayValue(dimension: FamilyDimension): number {
    const raw = dimensionParamValues[dimension.paramKey];
    if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
    if (typeof raw === 'string' && raw.trim() !== '') {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return Math.round(parsed);
    }
    return dimension.lockedValueMm;
  }

  return (
    <main
      data-testid="family-editor-shell"
      aria-label="Family editor workbench"
      className="space-y-6 p-4"
    >
      <header
        data-testid="family-editor-header"
        className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3"
      >
        <div>
          <h1 className="text-lg font-semibold text-foreground">Family editor</h1>
          <p className="text-sm text-muted">
            Author reusable parametric families outside the main workspace shell.
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 8px',
            borderBottom: '1px solid #444',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}>Category:</span>
          <select
            data-testid="family-editor-category-select"
            value={familyCategoryKey}
            onChange={(e) => {
              setFamilyCategoryKey(e.target.value);
              onSemanticCommand?.({
                type: 'setFamilyCategory',
                familyId: familyId,
                categoryKey: e.target.value,
              });
            }}
            style={{ fontSize: 11 }}
          >
            <option value="">-- Select Category --</option>
            {FAMILY_CATEGORIES.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      <section className="rounded border p-3 space-y-3" aria-label="Family template browser">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <span>Template search</span>
            <input
              aria-label="Search family templates"
              value={templateSearch}
              onChange={(e) => setTemplateSearch(e.target.value)}
              className="rounded border px-2 py-1"
              placeholder=".rft, category, host"
            />
          </label>
          <select
            aria-label="Filter family templates by host"
            value={templateHostFilter}
            onChange={(e) =>
              setTemplateHostFilter(e.target.value as AuthoredFamilyTemplateHostType | 'all')
            }
          >
            <option value="all">All hosts</option>
            {templateHostOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter family templates by category"
            value={templateCategoryFilter}
            onChange={(e) => setTemplateCategoryFilter(e.target.value as FamilyCategory | 'all')}
          >
            <option value="all">All categories</option>
            {templateCategoryOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted" data-testid="selected-template-metadata">
            {selectedTemplateEntry.fileName} · {selectedTemplateEntry.categoryLabel} ·{' '}
            {selectedTemplateEntry.hostLabel}
          </span>
        </div>
        <ul className="grid gap-2 md:grid-cols-2" data-testid="family-template-browser">
          {visibleTemplateEntries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={
                  template === entry.id
                    ? 'w-full rounded border border-accent bg-accent/10 p-2 text-left'
                    : 'w-full rounded border p-2 text-left'
                }
                onClick={() => selectTemplate(entry.id)}
                aria-pressed={template === entry.id}
                data-testid={`family-template-${entry.id}`}
              >
                <span className="block text-sm font-semibold">{entry.fileName}</span>
                <span className="block text-xs text-muted">
                  {entry.categoryLabel} · {entry.hostLabel}
                </span>
                <span className="block text-xs text-muted">{entry.description}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section
        data-testid="family-editor-ribbon"
        className="flex flex-wrap gap-2 rounded border border-border bg-surface p-2"
        aria-label="Family editor ribbon"
      >
        <button
          type="button"
          className="px-3 py-1 rounded border"
          onClick={startSweep}
          disabled={sweepDraft !== null}
          aria-label={t('familyEditor.sweepToggle')}
        >
          {t('familyEditor.sweepToggle')}
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded border"
          onClick={startArray}
          disabled={arrayDraft !== null}
          aria-label={t('familyEditor.arrayToggle')}
        >
          {t('familyEditor.arrayToggle')}
        </button>
        <button
          type="button"
          className={
            flexMode
              ? 'bg-warning text-warning-foreground px-3 py-1 rounded'
              : 'px-3 py-1 rounded border'
          }
          onClick={toggleFlexMode}
          aria-pressed={flexMode}
        >
          {t('familyEditor.flexToggle')}
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded border"
          onClick={addFamilySweepForm}
          data-testid="family-sweep-form-add"
          aria-label="Add family sweep form"
        >
          Sweep Form
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded border"
          onClick={addFamilyBlendForm}
          data-testid="family-blend-form-add"
          aria-label="Add family blend form"
        >
          Blend
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded border"
          onClick={addWindowFrameForm}
          data-testid="family-editor-add-frame-btn"
          aria-label="Add Window Frame"
        >
          Add Window Frame
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded border"
          onClick={addGlazingPanelForm}
          data-testid="family-editor-add-glazing-btn"
          aria-label="Add Glazing Panel"
        >
          Add Glazing Panel
        </button>
        <button
          type="button"
          className="px-3 py-1 rounded border"
          onClick={() => setFamilyTypesDialogOpen(true)}
          data-testid="family-types-open"
        >
          Family Types
        </button>
      </section>

      <section className="rounded border p-3" aria-label="Preview visibility controls">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label="Preview Visibility"
              checked={previewVisibility}
              onChange={(e) => setPreviewVisibility(e.target.checked)}
            />
            Preview Visibility
          </label>
          <select
            aria-label="Preview detail level"
            value={previewDetailLevel}
            onChange={(e) => setPreviewDetailLevel(e.target.value as DetailLevelKey)}
          >
            <option value="coarse">Coarse</option>
            <option value="medium">Medium</option>
            <option value="fine">Fine</option>
          </select>
          <select
            aria-label="Preview view type"
            value={previewViewType}
            onChange={(e) => setPreviewViewType(e.target.value as PreviewViewTypeKey)}
          >
            {FAMILY_VISIBILITY_VIEW_TYPES.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted" data-testid="preview-visibility-summary">
            {previewVisibility
              ? `${previewVisibleSweepCount}/${sweeps.length} sweeps, ${previewVisibleSymbolicLineCount}/${symbolicLines.length} symbolic lines, and ${previewVisibleNestedCount}/${nestedInstances.length} nested instances visible in ${FAMILY_VISIBILITY_VIEW_TYPES.find((option) => option.key === previewViewType)?.label ?? previewViewType}`
              : 'Preview visibility off'}
          </span>
        </div>
      </section>

      {arrayDraft && (
        <ArrayDraftPanel
          t={t}
          draft={arrayDraft}
          params={params}
          onUpdate={updateArrayDraft}
          onFinish={finishArray}
          onCancel={cancelArray}
        />
      )}

      <section
        className="grid gap-4 rounded border p-3 md:grid-cols-2"
        aria-label="Family settings"
      >
        <div className="space-y-2">
          <h2 className="font-semibold">Family Category and Parameters</h2>
          <label className="flex items-center gap-2 text-sm">
            <span className="w-36">Category</span>
            <select
              aria-label="Family category"
              value={categorySettings.category}
              onChange={(e) =>
                setCategorySettings((prev) => ({
                  ...prev,
                  category: e.target.value as FamilyCategory,
                }))
              }
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ['alwaysVertical', 'Always Vertical'],
              ['workPlaneBased', 'Work Plane-Based'],
              ['roomCalculationPoint', 'Room Calculation Point'],
              ['shared', 'Shared'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label={label}
                checked={categorySettings[key]}
                onChange={(e) =>
                  setCategorySettings((prev) => ({ ...prev, [key]: e.target.checked }))
                }
              />
              {label}
            </label>
          ))}
        </div>
        <div className="space-y-2">
          <h2 className="font-semibold">Family View Range</h2>
          {(
            [
              ['topOffsetMm', 'Top offset'],
              ['cutPlaneOffsetMm', 'Cut plane'],
              ['bottomOffsetMm', 'Bottom offset'],
              ['viewDepthOffsetMm', 'View depth'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <span className="w-28">{label}</span>
              <input
                type="number"
                aria-label={label}
                value={viewRange[key]}
                onChange={(e) =>
                  setViewRange((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                }
              />
              <span className="text-xs text-muted">mm</span>
            </label>
          ))}
          <p className="text-xs text-muted" data-testid="family-view-range-summary">
            Cut {viewRange.cutPlaneOffsetMm} mm · depth {viewRange.viewDepthOffsetMm} mm
          </p>
        </div>
      </section>

      <FamilyParameterPanel
        parameters={familyParameters}
        onAdd={(param) =>
          setFamilyParameters((prev) => [...prev, { ...param, id: crypto.randomUUID() }])
        }
        onDelete={(id) => setFamilyParameters((prev) => prev.filter((p) => p.id !== id))}
        onValueChange={(id, value) =>
          setFamilyParameters((prev) =>
            prev.map((p) => (p.id === id ? { ...p, defaultValue: value } : p)),
          )
        }
      />

      {/* §15.1.3 parametric constraints panel — local state, mirrors family_constraint elements */}
      <div className="border rounded p-3 flex flex-col gap-2">
        <strong className="text-xs font-semibold">Parametric Constraints</strong>
        {localConstraints.map((fc) => (
          <div
            key={fc.id}
            data-testid={`family-editor-constraint-${fc.id}`}
            className="text-xs text-muted flex items-center gap-2"
          >
            <span>
              {fc.paramName || '(no param)'} → {fc.axis.toUpperCase()}
            </span>
            <button
              className="ml-auto text-red-400"
              onClick={() => setLocalConstraints((prev) => prev.filter((c) => c.id !== fc.id))}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          data-testid="family-editor-add-constraint-btn"
          className="text-xs text-left"
          onClick={() =>
            setLocalConstraints((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                kind: 'family_constraint' as const,
                familyId,
                paramName: familyParameters[0]?.name ?? '',
                refPlaneId1: '',
                refPlaneId2: '',
                axis: 'x' as const,
              },
            ])
          }
        >
          + Add Constraint
        </button>
        <button
          data-testid="family-editor-add-component-btn"
          onClick={() =>
            onSemanticCommand?.({
              type: 'addFamilyComponent',
              familyId: familyId,
              componentTypeId: 'generic-component',
              label: 'Component',
              originMm: { xMm: 0, yMm: 0, zMm: 0 },
              rotationDeg: 0,
            })
          }
          style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid #444' }}
        >
          + Component
        </button>
        <button
          data-testid="family-editor-add-opening-cut-btn"
          onClick={() =>
            onSemanticCommand?.({
              type: 'setFamilyOpeningCut',
              familyId: familyId,
              widthMm: 900,
              heightMm: 2100,
              sillOffsetMm: 0,
            })
          }
          style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, border: '1px solid #444' }}
        >
          ✂ Opening Cut
        </button>
        {/* §15.1.3: reference plane */}
        <button
          data-testid="family-editor-add-ref-plane-btn"
          onClick={() =>
            onSemanticCommand?.({
              type: 'addFamilyReferencePlane',
              familyId: familyId,
              name: `Ref Plane ${refPlanes.length + 1}`,
              axis: 'x',
              offsetMm: 0,
              isReference: true,
            })
          }
          style={{ fontSize: 11, padding: '2px 6px', cursor: 'pointer' }}
        >
          + Ref Plane
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <LoadedFamiliesSidebar
          families={loadedFamilies}
          usageCounts={usageCounts}
          onAddInstance={(familyId) => addNestedFamilyInstance(familyId)}
        />
        <section
          className="border rounded p-3 min-h-[180px] flex flex-col gap-2"
          role="region"
          aria-label={t('familyEditor.editingCanvasAriaLabel')}
          data-testid="family-editing-canvas"
          onDrop={onCanvasDrop}
          onDragOver={onCanvasDragOver}
        >
          <header className="flex items-center gap-2">
            <h2 className="font-semibold">{t('familyEditor.editingCanvasHeading')}</h2>
            <span className="text-xs text-muted">
              {t('familyEditor.editingCanvasHint', { count: nestedInstances.length })}
            </span>
          </header>
          {nestedInstances.length === 0 ? (
            <p className="text-xs text-muted">{t('familyEditor.editingCanvasEmpty')}</p>
          ) : (
            <ul className="space-y-1 text-sm" data-testid="nested-instances-list">
              {nestedInstances.map((inst, i) =>
                visibleInPreview(inst) ? (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => setSelectedNestedIndex(i)}
                      className={
                        selectedNestedIndex === i
                          ? 'underline font-semibold'
                          : 'underline text-left'
                      }
                      aria-label={`select-nested-instance-${i}`}
                      data-testid={`nested-instance-${i}`}
                    >
                      {t('familyEditor.nestedInstanceListLabel', {
                        index: i + 1,
                        familyId: inst.familyId,
                        x: Math.round(inst.positionMm.xMm),
                        y: Math.round(inst.positionMm.yMm),
                      })}
                    </button>
                  </li>
                ) : null,
              )}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded border p-3 space-y-2" aria-label="Symbolic line authoring">
        <h2 className="font-semibold">Symbolic Lines and Detail Components</h2>
        <svg
          role="img"
          aria-label="Symbolic line drawing canvas"
          data-testid="symbolic-line-canvas"
          viewBox="0 0 480 260"
          className="h-64 w-full rounded border border-border bg-surface"
          onClick={drawSymbolicLineOnCanvas}
        >
          <line x1="240" y1="0" x2="240" y2="260" stroke="var(--color-border)" />
          <line x1="0" y1="130" x2="480" y2="130" stroke="var(--color-border)" />
          {refPlanes.map((plane) =>
            plane.isVertical ? (
              <line
                key={plane.id}
                data-testid={`symbolic-canvas-ref-plane-${plane.id}`}
                x1={240 + plane.offsetMm / 5}
                y1="0"
                x2={240 + plane.offsetMm / 5}
                y2="260"
                stroke="var(--color-accent)"
                strokeDasharray="5 4"
                onClick={(event) => {
                  if (!canvasAlignDraft.active) return;
                  event.stopPropagation();
                  setCanvasAlignDraft((prev) => ({ ...prev, refPlaneId: plane.id }));
                }}
              />
            ) : (
              <line
                key={plane.id}
                data-testid={`symbolic-canvas-ref-plane-${plane.id}`}
                x1="0"
                y1={130 - plane.offsetMm / 5}
                x2="480"
                y2={130 - plane.offsetMm / 5}
                stroke="var(--color-accent)"
                strokeDasharray="5 4"
                onClick={(event) => {
                  if (!canvasAlignDraft.active) return;
                  event.stopPropagation();
                  setCanvasAlignDraft((prev) => ({ ...prev, refPlaneId: plane.id }));
                }}
              />
            ),
          )}
          {symbolicLines.map((line, index) => {
            if (!visibleInPreview(line)) return null;
            const style = SYMBOLIC_LINE_OBJECT_STYLES[line.subcategory];
            const start = canvasCoord(line.startMm);
            const end = canvasCoord(line.endMm);
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            return (
              <g key={index}>
                <line
                  data-testid={`symbolic-canvas-line-${index}`}
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  strokeDasharray={style.dashArray}
                  strokeLinecap="round"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (canvasAlignDraft.active) alignCanvasSymbolicLine(index);
                    else setSelectedSymbolicLineIndex(index);
                  }}
                />
                {line.alignmentLock ? (
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`symbolic-lock-glyph-${index}`}
                    data-testid={`symbolic-lock-glyph-${index}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleSymbolicLineLock(index);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggleSymbolicLineLock(index);
                      }
                    }}
                  >
                    <circle cx={midX} cy={midY - 12} r="7" fill="var(--color-warning)" />
                    <text x={midX} y={midY - 8} textAnchor="middle" fontSize="10">
                      L
                    </text>
                  </g>
                ) : null}
              </g>
            );
          })}
          {mirrorDraft.active && mirrorDraft.axisStart ? (
            <circle
              data-testid="mirror-axis-start"
              cx={canvasCoord(mirrorDraft.axisStart).x}
              cy={canvasCoord(mirrorDraft.axisStart).y}
              r="4"
              fill="var(--color-warning)"
            />
          ) : null}
          {symbolicCanvasStart ? (
            <circle
              data-testid="symbolic-canvas-start"
              cx={240 + symbolicCanvasStart.xMm / 5}
              cy={130 - symbolicCanvasStart.yMm / 5}
              r="4"
              fill="var(--color-accent)"
            />
          ) : null}
        </svg>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            aria-label="Symbolic line subcategory"
            value={symbolicLineDraft.subcategory}
            onChange={(e) =>
              setSymbolicLineDraft((prev) => ({
                ...prev,
                subcategory: e.target.value as SymbolicLineSubcategory,
              }))
            }
          >
            <option value="symbolic">Symbolic Lines</option>
            <option value="opening_projection">Opening Projection</option>
            <option value="hidden_cut">Hidden Lines (Cut)</option>
          </select>
          {(
            [
              ['sx', 'symbolic-start-x'],
              ['sy', 'symbolic-start-y'],
              ['ex', 'symbolic-end-x'],
              ['ey', 'symbolic-end-y'],
            ] as const
          ).map(([key, label]) => (
            <input
              key={key}
              type="number"
              aria-label={label}
              value={symbolicLineDraft[key]}
              onChange={(e) =>
                setSymbolicLineDraft((prev) => ({ ...prev, [key]: Number(e.target.value) }))
              }
            />
          ))}
          <button type="button" onClick={addSymbolicLine} data-testid="symbolic-line-add">
            Add symbolic line
          </button>
          <button
            type="button"
            onClick={applyShow2DVisibilityPreset}
            data-testid="visibility-preset-show-2d"
          >
            Show 2D preset
          </button>
        </div>
        <ul className="space-y-1 text-xs" data-testid="symbolic-lines-list">
          {symbolicLines.map((line, index) =>
            visibleInPreview(line) ? (
              <li key={index} className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={
                    selectedSymbolicLineIndex === index
                      ? 'underline font-semibold'
                      : 'underline text-left'
                  }
                  onClick={() => setSelectedSymbolicLineIndex(index)}
                  aria-label={`select-symbolic-line-${index}`}
                >
                  {SYMBOLIC_LINE_OBJECT_STYLES[line.subcategory].label}: ({line.startMm.xMm},{' '}
                  {line.startMm.yMm}) → ({line.endMm.xMm}, {line.endMm.yMm})
                </button>
                <span
                  data-testid={`symbolic-line-style-${index}`}
                  className="rounded border border-border px-1 py-0.5"
                >
                  {SYMBOLIC_LINE_OBJECT_STYLES[line.subcategory].objectStyle} · weight{' '}
                  {SYMBOLIC_LINE_OBJECT_STYLES[line.subcategory].strokeWidth}
                  {SYMBOLIC_LINE_OBJECT_STYLES[line.subcategory].dashArray ? ' · dashed' : ''}
                </span>
                {line.alignmentLock ? <span>locked</span> : null}
                {line.visibilityBinding ? ` visible when ${line.visibilityBinding.paramName}` : ''}
                {line.visibilityByDetailLevel ? ' detail-filtered' : ''}
              </li>
            ) : null,
          )}
        </ul>
        <span
          className="sr-only"
          data-testid="symbolic-project-rendering-evidence"
          data-evidence={symbolicProjectRenderingEvidence}
        >
          {symbolicProjectRenderingEvidence}
        </span>
        {selectedSymbolicLine && selectedSymbolicLineIndex !== null ? (
          <SymbolicLinePropertiesPanel
            line={selectedSymbolicLine}
            params={params}
            onUpdate={(binding) => updateSymbolicLineVisibility(selectedSymbolicLineIndex, binding)}
            onAssociateVisibility={() =>
              updateSymbolicLineVisibility(selectedSymbolicLineIndex, {
                paramName: firstBooleanParamKey(),
                whenTrue: true,
              })
            }
            onUpdateDetailLevel={(level, visible) =>
              updateSymbolicLineDetailLevelVisibility(selectedSymbolicLineIndex, level, visible)
            }
            onUpdateViewType={(viewType, visible) =>
              updateSymbolicLineViewTypeVisibility(selectedSymbolicLineIndex, viewType, visible)
            }
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            type="button"
            className={
              canvasAlignDraft.active
                ? 'rounded bg-accent px-2 py-1 text-accent-foreground'
                : 'rounded border px-2 py-1'
            }
            onClick={() =>
              setCanvasAlignDraft((prev) => ({
                active: !prev.active,
                locked: prev.locked,
                refPlaneId: '',
              }))
            }
            data-testid="canvas-align-start"
          >
            Align on canvas
          </button>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              aria-label="canvas-align-lock"
              checked={canvasAlignDraft.locked}
              onChange={(event) =>
                setCanvasAlignDraft((prev) => ({ ...prev, locked: event.target.checked }))
              }
            />
            Lock
          </label>
          <span data-testid="canvas-align-status">
            {canvasAlignDraft.active
              ? canvasAlignDraft.refPlaneId
                ? 'pick line'
                : 'pick reference'
              : 'idle'}
          </span>
          <button
            type="button"
            className={
              mirrorDraft.active
                ? 'rounded bg-accent px-2 py-1 text-accent-foreground'
                : 'rounded border px-2 py-1'
            }
            disabled={selectedSymbolicLineIndex === null}
            onClick={() =>
              setMirrorDraft((prev) => ({
                active: !prev.active,
                copy: prev.copy,
                axisStart: null,
              }))
            }
            data-testid="family-mirror-draw-axis"
          >
            Mirror Draw Axis
          </button>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              aria-label="mirror-copy"
              checked={mirrorDraft.copy}
              onChange={(event) =>
                setMirrorDraft((prev) => ({ ...prev, copy: event.target.checked }))
              }
            />
            Copy
          </label>
        </div>
        {symbolicLines.length > 0 && refPlanes.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span>Align</span>
            <select
              aria-label="align-symbolic-line"
              value={symbolicAlignDraft.lineIndex}
              onChange={(e) =>
                setSymbolicAlignDraft((prev) => ({ ...prev, lineIndex: Number(e.target.value) }))
              }
            >
              {symbolicLines.map((_line, index) => (
                <option key={index} value={index}>
                  Line {index + 1}
                </option>
              ))}
            </select>
            <select
              aria-label="align-reference-plane"
              value={symbolicAlignDraft.refPlaneId || refPlanes[0]?.id || ''}
              onChange={(e) =>
                setSymbolicAlignDraft((prev) => ({ ...prev, refPlaneId: e.target.value }))
              }
            >
              {refPlanes.map((plane) => (
                <option key={plane.id} value={plane.id}>
                  {plane.name} {plane.isVertical ? 'V' : 'H'} {plane.offsetMm}mm
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                aria-label="align-lock"
                checked={symbolicAlignDraft.locked}
                onChange={(e) =>
                  setSymbolicAlignDraft((prev) => ({ ...prev, locked: e.target.checked }))
                }
              />
              Lock
            </label>
            <button
              type="button"
              onClick={alignSelectedSymbolicLine}
              data-testid="symbolic-line-align"
            >
              Align
            </button>
          </div>
        ) : null}
      </section>

      {selectedNested && selectedNestedIndex !== null && (
        <NestedInstanceInspector
          instance={selectedNested}
          nestedFamily={selectedNestedFamily}
          hostParams={hostParamRefs}
          onUpdate={(patch) => updateNestedInstance(selectedNestedIndex, patch)}
        />
      )}

      {arrays.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">{t('familyEditor.arraysHeading')}</h2>
          <ul className="text-sm">
            {arrays.map((a, i) => (
              <li key={i} data-testid={`array-${i}`}>
                {t('familyEditor.arrayLabel', {
                  index: i + 1,
                  mode: a.mode,
                  countParam: a.countParam,
                })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sweepDraft && (
        <section
          className="border rounded p-3 space-y-2"
          aria-label={t('familyEditor.sweepSketchAriaLabel')}
          role="dialog"
        >
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{t('familyEditor.sweepHeading')}</h2>
            <span className="text-xs text-muted">
              {t(
                sweepDraft.step === 'path'
                  ? 'familyEditor.sweepStepPath'
                  : 'familyEditor.sweepStepProfile',
              )}
            </span>
            <button type="button" onClick={cancelSweep} className="ml-auto text-sm underline">
              {t('familyEditor.sweepCancel')}
            </button>
          </div>
          {sweepDraft.step === 'path' ? (
            <SweepPathSketch
              t={t}
              lines={sweepDraft.pathLines}
              onAppendLine={appendSweepPathLine}
              onAdvance={advanceSweepToProfile}
            />
          ) : (
            <SweepProfileSketch
              t={t}
              lines={sweepDraft.profile}
              refPlanes={refPlanes}
              familyGeometryLines={pickableFamilyGeometryLines()}
              onAppendLine={appendSweepProfileLine}
              onPickReferencePlane={appendPickedProfileRefPlane}
              onPickFamilyGeometry={appendPickedProfileFamilyGeometry}
              onAppendCircle={appendSweepProfileCircle}
              onCopyCircle={copySweepProfileCircle}
              onTrimExtend={trimExtendProfileLines}
              onFinish={finishSweep}
            />
          )}
        </section>
      )}

      {sweeps.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">{t('familyEditor.sweepsHeading')}</h2>
          <ul className="text-sm">
            {sweeps.map((s, i) =>
              sweepVisibleInPreview(s) ? (
                <li key={i} data-testid={`sweep-${i}`}>
                  <button
                    type="button"
                    className={
                      selectedSweepIndex === i ? 'underline font-semibold' : 'underline text-left'
                    }
                    onClick={() => setSelectedSweepIndex(i)}
                    aria-label={`select-sweep-${i}`}
                  >
                    {t('familyEditor.sweepLabel', {
                      index: i + 1,
                      pathSegs: s.pathLines.length,
                      profSegs: s.profile.length,
                    })}
                  </button>
                  {s.visibilityBinding && (
                    <span className="ml-2 text-xs text-muted">
                      {t('familyEditor.visibleWhenSummary', {
                        paramName: s.visibilityBinding.paramName,
                        state: s.visibilityBinding.whenTrue
                          ? t('familyEditor.showWhenTrue')
                          : t('familyEditor.showWhenFalse'),
                      })}
                    </span>
                  )}
                </li>
              ) : null,
            )}
          </ul>
          {selectedSweepIndex !== null && sweeps[selectedSweepIndex] && (
            <SweepPropertiesPanel
              t={t}
              sweep={sweeps[selectedSweepIndex]}
              params={params}
              onUpdate={(binding) => updateSweepVisibility(selectedSweepIndex, binding)}
              onUpdateMaterial={(materialKey) =>
                updateSweepMaterial(selectedSweepIndex, materialKey)
              }
              onUpdatePathLengthParam={(paramName) =>
                updateSweepPathLengthParam(selectedSweepIndex, paramName)
              }
              onUpdatePathStartOffsetParam={(paramName) =>
                updateSweepPathStartOffsetParam(selectedSweepIndex, paramName)
              }
              onUpdatePathEndOffsetParam={(paramName) =>
                updateSweepPathEndOffsetParam(selectedSweepIndex, paramName)
              }
              onUpdateMaterialParam={(paramName) =>
                updateSweepMaterialParam(selectedSweepIndex, paramName)
              }
              onAssociateVisibility={() =>
                updateSweepVisibility(selectedSweepIndex, {
                  paramName: firstBooleanParamKey(),
                  whenTrue: true,
                })
              }
              onAssociatePathLength={() =>
                updateSweepPathLengthParam(
                  selectedSweepIndex,
                  ensureLengthParam('Extrusion_Depth', 'Extrusion Depth', 1000),
                )
              }
              onAssociatePathStart={() =>
                updateSweepPathStartOffsetParam(
                  selectedSweepIndex,
                  ensureLengthParam('Extrusion_Start', 'Extrusion Start', 0),
                )
              }
              onAssociatePathEnd={() =>
                updateSweepPathEndOffsetParam(
                  selectedSweepIndex,
                  ensureLengthParam('Extrusion_End', 'Extrusion End', 1000),
                )
              }
              onOpenMaterialBrowser={() =>
                setMaterialTarget({ kind: 'sweep', index: selectedSweepIndex })
              }
              onOpenAppearanceAssetBrowser={() =>
                setAppearanceTarget({ kind: 'sweep', index: selectedSweepIndex })
              }
              onUpdateDetailLevel={(level, visible) =>
                updateSweepDetailLevelVisibility(selectedSweepIndex, level, visible)
              }
              onUpdateViewType={(viewType, visible) =>
                updateSweepViewTypeVisibility(selectedSweepIndex, viewType, visible)
              }
            />
          )}
        </section>
      )}

      {(familySweepForms.length > 0 ||
        familyBlendForms.length > 0 ||
        familyWindowFrameForms.length > 0 ||
        familyGlazingForms.length > 0) && (
        <section aria-label="Geometry forms">
          <h2 className="font-semibold mb-2">Geometry Forms</h2>
          <ul className="text-sm space-y-1">
            {familySweepForms.map((form, i) => (
              <li key={form.id} data-testid={`family-sweep-form-${i}`}>
                Sweep Form {i + 1} — {form.profilePoints.length} profile pts,{' '}
                {form.pathPoints.length} path pts
              </li>
            ))}
            {familyBlendForms.map((form, i) => (
              <li key={form.id} data-testid={`family-blend-form-${i}`}>
                Blend Form {i + 1} — {form.bottomProfilePoints.length} bottom pts →{' '}
                {form.topProfilePoints.length} top pts, h={form.heightMm}mm
              </li>
            ))}
            {familyWindowFrameForms.map((form, i) => (
              <li key={form.id} data-testid={`family-window-frame-form-${i}`}>
                Window Frame {i + 1} — {(form as SizedFamilyExtrusion).widthMm ?? 900}×
                {(form as SizedFamilyExtrusion).heightMm ?? 1200}mm, frame=
                {form.frameInnerWidthMm ?? 50}mm
              </li>
            ))}
            {familyGlazingForms.map((form, i) => (
              <li key={form.id} data-testid={`family-glazing-form-${i}`}>
                Glazing Panel {i + 1} — {(form as SizedFamilyExtrusion).widthMm ?? 800}×
                {(form as SizedFamilyExtrusion).heightMm ?? 1100}mm
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-2">{t('familyEditor.referencePlanesHeading')}</h2>
        <ul className="space-y-1 mb-2">
          {refPlanes.map((plane, index) => (
            <li key={plane.id} className="flex flex-wrap items-center gap-3">
              <span className="sr-only">{plane.name}</span>
              <input
                aria-label={`ref-plane-name-${index}`}
                value={plane.name}
                onChange={(e) => updateRefPlane(index, { name: e.target.value })}
                className="w-36 rounded border px-1 py-0.5 text-xs"
              />
              <span>{plane.isVertical ? 'V' : 'H'}</span>
              <select
                aria-label={`ref-plane-reference-type-${index}`}
                value={plane.referenceType}
                onChange={(e) =>
                  updateRefPlane(index, {
                    referenceType: e.target.value as RefPlane['referenceType'],
                  })
                }
                className="rounded border px-1 py-0.5 text-xs"
              >
                <option value="strong_reference">Strong Reference</option>
                <option value="weak_reference">Weak Reference</option>
                <option value="not_reference">Not a Reference</option>
              </select>
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  aria-label={`ref-plane-locked-${index}`}
                  checked={plane.locked}
                  onChange={(e) => updateRefPlane(index, { locked: e.target.checked })}
                />
                Locked
              </label>
              <label className="flex items-center gap-1 text-sm">
                <span className="sr-only">Offset</span>
                <input
                  type="number"
                  aria-label={`ref-plane-offset-${index}`}
                  value={plane.offsetMm}
                  onChange={(e) => updateRefPlane(index, { offsetMm: Number(e.target.value) })}
                  className="w-24 rounded border px-1 py-0.5 text-xs"
                />
                <span>mm</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button type="button" onClick={() => addRefPlane(false)}>
            {t('familyEditor.addHorizontal')}
          </button>
          <button type="button" onClick={() => addRefPlane(true)}>
            {t('familyEditor.addVertical')}
          </button>
        </div>
      </section>

      <FamilyEditorAlignedDimensionsSection
        refPlanes={refPlanes}
        dimensions={dimensions}
        eqConstraints={eqConstraints}
        lengthParams={lengthParams}
        dimensionDraft={dimensionDraft}
        setDimensionDraft={setDimensionDraft}
        eqOrientation={eqOrientation}
        setEqOrientation={setEqOrientation}
        eqPickedRefIds={eqPickedRefIds}
        setEqPickedRefIds={setEqPickedRefIds}
        setEqPickMode={setEqPickMode}
        dimensionDisplayValue={dimensionDisplayValue}
        toggleEqPickedRef={toggleEqPickedRef}
        removeEqConstraint={removeEqConstraint}
        createEqConstraint={createEqConstraint}
        createPickedEqConstraint={createPickedEqConstraint}
        createDimensionParameter={createDimensionParameter}
        updateDimensionLabel={updateDimensionLabel}
      />

      <FamilyEditorParametersSection
        t={t}
        params={params}
        validateFormula={validateFormula}
        updateParam={updateParam}
        addParam={addParam}
        setMaterialTarget={setMaterialTarget}
        setAppearanceTarget={setAppearanceTarget}
      />

      {flexMode && (
        <section
          aria-label={t('familyEditor.flexSidebarAriaLabel')}
          className="border rounded p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{t('familyEditor.flexHeading')}</h2>
            <button type="button" onClick={resetFlexValues} className="ml-auto text-sm underline">
              {t('familyEditor.flexReset')}
            </button>
          </div>
          {params.length === 0 ? (
            <p className="text-sm text-muted">{t('familyEditor.flexNoParams')}</p>
          ) : (
            <ul className="space-y-1">
              {params.map((param) => {
                const isNumeric = param.type === 'length_mm' || param.type === 'angle_deg';
                const flexRaw = flexValues[param.key];
                const inputValue = flexRaw === undefined || flexRaw === null ? '' : String(flexRaw);
                return (
                  <li key={param.key} className="flex items-center gap-2">
                    <label className="w-32 text-sm">{param.label || param.key}</label>
                    <input
                      type={isNumeric ? 'number' : 'text'}
                      value={inputValue}
                      placeholder={String(param.default)}
                      aria-label={`flex-${param.key}`}
                      onChange={(e) => setFlexValue(param.key, e.target.value)}
                    />
                    <span className="text-xs text-muted" data-testid={`resolved-${param.key}`}>
                      = {String(resolved[param.key])}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {familyTypesDialogOpen ? (
        <FamilyTypesDialog
          params={params}
          familyTypes={familyTypes}
          activeFamilyTypeId={activeFamilyTypeId}
          onSetActive={setActiveFamilyTypeId}
          onUpsert={upsertFamilyTypeRow}
          onCreate={createFamilyTypeRow}
          onDelete={deleteFamilyTypeRow}
          onClose={() => setFamilyTypesDialogOpen(false)}
        />
      ) : null}

      <section className="rounded border p-3" aria-label="Family persistence">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <span>Family name</span>
            <input
              aria-label="Family name"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-2">
            <span>Family id</span>
            <input
              aria-label="Family id"
              value={familyId}
              onChange={(e) => setFamilyId(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </label>
          <button
            type="button"
            className="rounded border px-2 py-1"
            onClick={saveFamilyDocument}
            data-testid="family-save"
          >
            Save Family
          </button>
          <select
            aria-label="Open saved family"
            defaultValue=""
            onChange={(e) => {
              loadFamilyDocument(e.target.value);
              e.currentTarget.value = '';
            }}
          >
            <option value="">Open</option>
            {savedFamilies.map((document) => (
              <option key={document.id} value={document.id}>
                {document.name}
              </option>
            ))}
          </select>
          {persistenceMessage ? (
            <span className="text-xs text-muted" data-testid="family-persistence-message">
              {persistenceMessage}
            </span>
          ) : null}
        </div>
      </section>

      <button
        type="button"
        onClick={() => void loadFamilyIntoProject()}
        data-testid="family-load-into-project"
      >
        {t('familyEditor.loadIntoProject')}
      </button>
      {pendingLoadPlan ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reload Family"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
        >
          <div className="w-full max-w-md rounded border border-border bg-surface p-4 shadow-lg">
            <h2 className="text-sm font-semibold">Reload Family</h2>
            <p className="mt-2 text-sm text-muted">
              {familyName.trim() || 'Untitled Family'} already exists in this project.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded border px-2 py-1 text-sm"
                onClick={async () => {
                  const document = currentAuthoredFamilyDocument();
                  const plan = planAuthoredFamilyLoad(document, projectFamilyElements, {
                    now: now(),
                    overwriteOption: 'keep-existing-values',
                  });
                  setPendingLoadPlan(null);
                  await applyAuthoredFamilyLoadPlan(plan);
                }}
                data-testid="family-reload-keep-values"
              >
                Keep existing values
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-sm"
                onClick={async () => {
                  const document = currentAuthoredFamilyDocument();
                  const plan = planAuthoredFamilyLoad(document, projectFamilyElements, {
                    now: now(),
                    overwriteOption: 'overwrite-parameter-values',
                  });
                  setPendingLoadPlan(null);
                  await applyAuthoredFamilyLoadPlan(plan);
                }}
                data-testid="family-reload-overwrite-values"
              >
                Overwrite parameter values
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-sm"
                onClick={() => setPendingLoadPlan(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {materialTarget ? (
        <MaterialBrowserDialog
          currentKey={materialKeyForTarget(materialTarget)}
          onAssign={(materialKey) => {
            assignMaterial(materialTarget, materialKey);
            setMaterialTarget(null);
          }}
          onClose={() => setMaterialTarget(null)}
        />
      ) : null}
      {appearanceTarget ? (
        <AppearanceAssetBrowserDialog
          currentKey={materialKeyForTarget(appearanceTarget)}
          onReplace={(materialKey) => {
            assignMaterial(appearanceTarget, materialKey);
            setAppearanceTarget(null);
          }}
          onClose={() => setAppearanceTarget(null)}
        />
      ) : null}
      {lastNestedAction && (
        <span
          data-testid="last-nested-action"
          data-family-id={lastNestedAction.familyId}
          data-x={lastNestedAction.positionMm.xMm}
          data-y={lastNestedAction.positionMm.yMm}
          className="sr-only"
        >
          {lastNestedAction.type}:{lastNestedAction.familyId}
        </span>
      )}
    </main>
  );
}
