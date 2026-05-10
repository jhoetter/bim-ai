import { useMemo, useState, type DragEvent, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ArrayGeometryNode,
  FamilyDefinition,
  FamilyInstanceRefNode,
  FamilyParamDef,
  SketchLine,
  SweepGeometryNode,
  VisibilityBinding,
  VisibilityByDetailLevel,
} from '../families/types';
import { validateFormula } from '../lib/expressionEvaluator';
import { BUILT_IN_FAMILIES } from '../families/familyCatalog';
import { LoadedFamiliesSidebar, NESTED_FAMILY_DRAG_TYPE } from './LoadedFamiliesSidebar';
import { NestedInstanceInspector, type HostParamRef } from './NestedInstanceInspector';
import { AppearanceAssetBrowserDialog } from './AppearanceAssetBrowserDialog';
import {
  pickedReferencePlaneLine,
  rederiveLockedSketchLines,
  trimExtendSketchLinesToCorner,
  type FamilySketchRefPlane,
} from './familySketchGeometry';
import { MaterialBrowserDialog } from './MaterialBrowserDialog';
import { resolveMaterial } from '../viewport/materials';

/** VIE-02 — plan detail levels usable for per-node visibility binding. */
type DetailLevelKey = 'coarse' | 'medium' | 'fine';

type Template = 'generic_model' | 'door' | 'window' | 'profile';

type RefPlane = FamilySketchRefPlane & {
  id: string;
  name: string;
  isVertical: boolean;
  offsetMm: number;
  isSymmetryRef: boolean;
};

type Param = {
  key: string;
  label: string;
  type: FamilyParamDef['type'];
  default: unknown;
  formula: string;
};

type FamilyTypeRow = {
  id: string;
  name: string;
  values: Record<string, unknown>;
};

/**
 * Resolve a family parameter for rendering.
 *
 * `paramOverrides` (used by FAM-09 flex mode) takes priority over the
 * authored default. Flex values are *not* persisted on save — exiting
 * flex mode discards them, so callers pass `undefined` when flex mode
 * is off.
 */
export function resolveFamilyParamValue(
  param: Param,
  paramOverrides?: Record<string, unknown>,
): unknown {
  if (paramOverrides && param.key in paramOverrides) {
    const override = paramOverrides[param.key];
    if (override !== undefined && override !== '') {
      return override;
    }
  }
  return param.default;
}

type SweepDraft = {
  pathLines: SketchLine[];
  profile: SketchLine[];
  profilePlane: 'normal_to_path_start' | 'work_plane';
  /** which sub-step the user is in: drawing the path, or sketching the
   *  profile loop. */
  step: 'path' | 'profile';
};

type MaterialAssignmentTarget = { kind: 'param'; index: number } | { kind: 'sweep'; index: number };

const DEFAULT_FAMILY_TYPE_ID = 'family-type-1';

function initialFamilyTypeRows(): FamilyTypeRow[] {
  return [{ id: DEFAULT_FAMILY_TYPE_ID, name: 'Type 1', values: {} }];
}

const EMPTY_SWEEP_DRAFT: SweepDraft = {
  pathLines: [],
  profile: [],
  profilePlane: 'normal_to_path_start',
  step: 'path',
};

const SKETCH_REF_EXTENT_MM = 1000;

/* ─── FAM-05: Array authoring draft ─────────────────────────────────────── */

type ArrayDraft = {
  targetFamilyId: string;
  mode: 'linear' | 'radial';
  countParam: string;
  spacingMode: 'fixed_mm' | 'fit_total';
  fixedMm: number;
  totalLengthParam: string;
  axisStart: { xMm: number; yMm: number; zMm: number };
  axisEnd: { xMm: number; yMm: number; zMm: number };
};

const EMPTY_ARRAY_DRAFT: ArrayDraft = {
  targetFamilyId: '',
  mode: 'linear',
  countParam: '',
  spacingMode: 'fixed_mm',
  fixedMm: 400,
  totalLengthParam: '',
  axisStart: { xMm: 0, yMm: 0, zMm: 0 },
  axisEnd: { xMm: 1000, yMm: 0, zMm: 0 },
};

function arrayDraftToNode(draft: ArrayDraft): ArrayGeometryNode {
  return {
    kind: 'array',
    target: {
      kind: 'family_instance_ref',
      familyId: draft.targetFamilyId,
      positionMm: { xMm: 0, yMm: 0, zMm: 0 },
      rotationDeg: 0,
      parameterBindings: {},
    },
    mode: draft.mode,
    countParam: draft.countParam,
    spacing:
      draft.spacingMode === 'fixed_mm'
        ? { kind: 'fixed_mm', mm: draft.fixedMm }
        : { kind: 'fit_total', totalLengthParam: draft.totalLengthParam },
    axisStart: draft.axisStart,
    axisEnd: draft.axisEnd,
  };
}

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

export function FamilyEditorWorkbench(): JSX.Element {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<Template>('generic_model');
  const [refPlanes, setRefPlanes] = useState<RefPlane[]>([]);
  const [params, setParams] = useState<Param[]>([]);
  const [familyTypes, setFamilyTypes] = useState<FamilyTypeRow[]>(() => initialFamilyTypeRows());
  const [activeFamilyTypeId, setActiveFamilyTypeId] = useState(DEFAULT_FAMILY_TYPE_ID);
  const [familyTypesDialogOpen, setFamilyTypesDialogOpen] = useState(false);
  const [flexMode, setFlexMode] = useState(false);
  const [flexValues, setFlexValues] = useState<Record<string, unknown>>({});
  const [sweeps, setSweeps] = useState<SweepGeometryNode[]>([]);
  const [sweepDraft, setSweepDraft] = useState<SweepDraft | null>(null);
  const [selectedSweepIndex, setSelectedSweepIndex] = useState<number | null>(null);
  const [arrays, setArrays] = useState<ArrayGeometryNode[]>([]);
  const [arrayDraft, setArrayDraft] = useState<ArrayDraft | null>(null);
  const [nestedInstances, setNestedInstances] = useState<FamilyInstanceRefNode[]>([]);
  const [selectedNestedIndex, setSelectedNestedIndex] = useState<number | null>(null);
  const [materialTarget, setMaterialTarget] = useState<MaterialAssignmentTarget | null>(null);
  const [appearanceTarget, setAppearanceTarget] = useState<MaterialAssignmentTarget | null>(null);
  const [lastNestedAction, setLastNestedAction] = useState<AddNestedFamilyInstanceAction | null>(
    null,
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
      },
    ]);
  }

  function updateRefPlane(index: number, patch: Partial<RefPlane>) {
    const next = refPlanes.map((plane, i) => (i === index ? { ...plane, ...patch } : plane));
    setRefPlanes(next);
    setSweepDraft((draft) =>
      draft
        ? {
            ...draft,
            pathLines: rederiveLockedSketchLines(draft.pathLines, next, SKETCH_REF_EXTENT_MM),
            profile: rederiveLockedSketchLines(draft.profile, next, SKETCH_REF_EXTENT_MM),
          }
        : draft,
    );
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
      },
    ]);
  }

  function updateParam(index: number, patch: Partial<Param>) {
    setParams((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  function upsertFamilyTypeRow(row: FamilyTypeRow) {
    setFamilyTypes((prev) => prev.map((candidate) => (candidate.id === row.id ? row : candidate)));
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
    setSweepDraft((prev) => (prev ? { ...prev, profile: [...prev.profile, line] } : prev));
  }

  function appendPickedProfileRefPlane(planeId: string, locked: boolean) {
    const plane = refPlanes.find((candidate) => candidate.id === planeId);
    if (!plane) return;
    appendSweepProfileLine(pickedReferencePlaneLine(plane, locked, SKETCH_REF_EXTENT_MM));
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
      };
      setSweeps((s) => [...s, node]);
      return null;
    });
  }

  function cancelSweep() {
    setSweepDraft(null);
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
    // Filter the catalog to families compatible with the host's
    // category. `generic_model` and `profile` host any discipline;
    // `door` / `window` hosts pull in same-discipline plus generic
    // helpers (e.g. swing-arc). Keep the rule simple: same-template
    // → same-discipline; generic templates → all families.
    if (template === 'generic_model' || template === 'profile') return BUILT_IN_FAMILIES;
    return BUILT_IN_FAMILIES.filter((f) => f.discipline === template || f.discipline === 'generic');
  }, [template]);

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

  const templates: { value: Template; label: string }[] = [
    { value: 'generic_model', label: t('familyEditor.templateGenericModel') },
    { value: 'door', label: t('familyEditor.templateDoor') },
    { value: 'window', label: t('familyEditor.templateWindow') },
    { value: 'profile', label: t('familyEditor.templateProfile') },
  ];

  return (
    <div className="p-4 space-y-6">
      <div className="flex gap-2">
        {templates.map(({ value, label }) => (
          <button
            type="button"
            key={value}
            className={
              template === value
                ? 'bg-accent text-accent-foreground px-3 py-1 rounded'
                : 'px-3 py-1 rounded border'
            }
            onClick={() => setTemplate(value)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="px-3 py-1 rounded border ml-auto"
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
          onClick={() => setFamilyTypesDialogOpen(true)}
          data-testid="family-types-open"
        >
          Family Types
        </button>
      </div>

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
              {nestedInstances.map((inst, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setSelectedNestedIndex(i)}
                    className={
                      selectedNestedIndex === i ? 'underline font-semibold' : 'underline text-left'
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
              ))}
            </ul>
          )}
        </section>
      </div>

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
              onAppendLine={appendSweepProfileLine}
              onPickReferencePlane={appendPickedProfileRefPlane}
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
            {sweeps.map((s, i) => (
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
            ))}
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
              onOpenMaterialBrowser={() =>
                setMaterialTarget({ kind: 'sweep', index: selectedSweepIndex })
              }
              onOpenAppearanceAssetBrowser={() =>
                setAppearanceTarget({ kind: 'sweep', index: selectedSweepIndex })
              }
              onUpdateDetailLevel={(level, visible) =>
                updateSweepDetailLevelVisibility(selectedSweepIndex, level, visible)
              }
            />
          )}
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-2">{t('familyEditor.referencePlanesHeading')}</h2>
        <ul className="space-y-1 mb-2">
          {refPlanes.map((plane, index) => (
            <li key={plane.id} className="flex gap-4">
              <span>{plane.name}</span>
              <span>{plane.isVertical ? 'V' : 'H'}</span>
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

      <section>
        <h2 className="font-semibold mb-2">{t('familyEditor.parametersHeading')}</h2>
        <table className="w-full mb-2">
          <thead>
            <tr>
              <th>Key</th>
              <th>Label</th>
              <th>Type</th>
              <th>Default</th>
              <th>{t('familyEditor.formulaLabel')}</th>
            </tr>
          </thead>
          <tbody>
            {params.map((param, i) => {
              const otherParams = params.filter((_, j) => j !== i).map((p) => p.key);
              const formulaError = validateFormula(param.formula, otherParams);
              return (
                <tr key={i}>
                  <td>
                    <input
                      value={param.key}
                      onChange={(e) => updateParam(i, { key: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={param.label}
                      onChange={(e) => updateParam(i, { label: e.target.value })}
                    />
                  </td>
                  <td>
                    <select
                      value={param.type}
                      onChange={(e) =>
                        updateParam(i, { type: e.target.value as FamilyParamDef['type'] })
                      }
                    >
                      <option value="length_mm">length_mm</option>
                      <option value="angle_deg">angle_deg</option>
                      <option value="material_key">material_key</option>
                      <option value="boolean">boolean</option>
                      <option value="option">option</option>
                    </select>
                  </td>
                  <td>
                    {(param.type === 'length_mm' || param.type === 'angle_deg') && (
                      <input
                        type="number"
                        value={param.default as number}
                        onChange={(e) => updateParam(i, { default: Number(e.target.value) })}
                      />
                    )}
                    {param.type === 'material_key' && (
                      <MaterialDefaultEditor
                        materialKey={typeof param.default === 'string' ? param.default : ''}
                        onOpenBrowser={() => setMaterialTarget({ kind: 'param', index: i })}
                        onOpenAssetBrowser={() => setAppearanceTarget({ kind: 'param', index: i })}
                      />
                    )}
                  </td>
                  <td>
                    <input
                      value={param.formula}
                      aria-invalid={formulaError !== null}
                      aria-label={`formula-${param.key}`}
                      onChange={(e) => updateParam(i, { formula: e.target.value })}
                    />
                    {formulaError && (
                      <span
                        role="alert"
                        className="ml-1 text-xs text-danger"
                        data-testid={`formula-error-${param.key}`}
                      >
                        {formulaError}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <button type="button" onClick={addParam}>
          {t('familyEditor.addParameter')}
        </button>
      </section>

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

      <button
        type="button"
        onClick={() =>
          console.warn('load-into-project stub', {
            template,
            refPlanes,
            params,
            resolved,
            sweeps,
            materialKeys: {
              params: params
                .filter((param) => param.type === 'material_key')
                .map((param) => ({ key: param.key, materialKey: param.default })),
              sweeps: sweeps.map((sweep, index) => ({
                index,
                materialKey: sweep.materialKey ?? null,
              })),
            },
          })
        }
      >
        {t('familyEditor.loadIntoProject')}
      </button>
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
    </div>
  );
}

interface SweepPropertiesPanelProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  sweep: SweepGeometryNode;
  params: Param[];
  onUpdate: (binding: VisibilityBinding | undefined) => void;
  onUpdateMaterial: (materialKey: string | null) => void;
  onOpenMaterialBrowser: () => void;
  onOpenAppearanceAssetBrowser: () => void;
  onUpdateDetailLevel: (level: DetailLevelKey, visible: boolean) => void;
}

const VISIBLE_ALWAYS = '__always__';

function parseFamilyTypeValue(param: Param, raw: string): unknown {
  if (param.type === 'length_mm' || param.type === 'angle_deg') {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : raw;
  }
  if (param.type === 'boolean') return raw === 'true';
  return raw;
}

function FamilyTypesDialog({
  params,
  familyTypes,
  activeFamilyTypeId,
  onSetActive,
  onUpsert,
  onCreate,
  onDelete,
  onClose,
}: {
  params: Param[];
  familyTypes: FamilyTypeRow[];
  activeFamilyTypeId: string;
  onSetActive: (id: string) => void;
  onUpsert: (row: FamilyTypeRow) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}): JSX.Element {
  const active = familyTypes.find((row) => row.id === activeFamilyTypeId) ?? familyTypes[0]!;

  function updateActive(patch: Partial<FamilyTypeRow>) {
    onUpsert({ ...active, ...patch });
  }

  function updateValue(param: Param, raw: string) {
    updateActive({
      values: {
        ...active.values,
        [param.key]: parseFamilyTypeValue(param, raw),
      },
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Family Types"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
    >
      <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded border border-border bg-surface shadow-lg">
        <header className="flex items-center gap-2 border-b border-border px-3 py-2">
          <h2 className="text-sm font-semibold">Family Types</h2>
          <button type="button" className="ml-auto text-xs underline" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="grid max-h-[72vh] grid-cols-[220px_1fr] overflow-hidden">
          <aside className="border-r border-border p-3">
            <button
              type="button"
              className="mb-2 rounded border px-2 py-1 text-xs"
              onClick={onCreate}
              data-testid="family-types-new"
            >
              New Type
            </button>
            <ul className="space-y-1">
              {familyTypes.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={
                      row.id === activeFamilyTypeId
                        ? 'w-full rounded bg-accent/15 px-2 py-1 text-left text-xs'
                        : 'w-full rounded px-2 py-1 text-left text-xs hover:bg-surface-strong'
                    }
                    onClick={() => onSetActive(row.id)}
                    data-testid={`family-type-row-${row.id}`}
                  >
                    {row.name}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <section className="overflow-y-auto p-3">
            <label className="mb-3 flex items-center gap-2 text-sm">
              <span className="w-24">Type name</span>
              <input
                aria-label="Family type name"
                className="rounded border px-2 py-1 text-sm"
                value={active.name}
                onChange={(e) => updateActive({ name: e.target.value })}
              />
            </label>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Parameter</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Value</th>
                </tr>
              </thead>
              <tbody>
                {params.map((param) => {
                  const raw = active.values[param.key] ?? param.default ?? '';
                  return (
                    <tr key={param.key}>
                      <td>{param.label || param.key}</td>
                      <td>{param.type}</td>
                      <td>
                        {param.type === 'boolean' ? (
                          <select
                            aria-label={`family-type-value-${param.key}`}
                            value={String(Boolean(raw))}
                            onChange={(e) => updateValue(param, e.target.value)}
                          >
                            <option value="true">True</option>
                            <option value="false">False</option>
                          </select>
                        ) : (
                          <input
                            aria-label={`family-type-value-${param.key}`}
                            type={
                              param.type === 'length_mm' || param.type === 'angle_deg'
                                ? 'number'
                                : 'text'
                            }
                            value={String(raw)}
                            onChange={(e) => updateValue(param, e.target.value)}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3">
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                disabled={familyTypes.length <= 1}
                onClick={() => onDelete(active.id)}
                data-testid="family-types-delete"
              >
                Delete Type
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function MaterialDefaultEditor({
  materialKey,
  onOpenBrowser,
  onOpenAssetBrowser,
}: {
  materialKey: string;
  onOpenBrowser: () => void;
  onOpenAssetBrowser: () => void;
}): JSX.Element {
  const material = resolveMaterial(materialKey);
  return (
    <div
      className="flex flex-wrap items-center gap-2 text-xs"
      data-testid="material-default-editor"
    >
      <span
        className="h-5 w-5 rounded border border-border"
        style={{ backgroundColor: material?.baseColor ?? '#cccccc' }}
        aria-hidden="true"
      />
      <span className="max-w-36 truncate" data-testid="material-default-label">
        {material ? material.displayName : materialKey || 'None'}
      </span>
      <button type="button" className="rounded border px-2 py-0.5" onClick={onOpenBrowser}>
        Browse
      </button>
      <button type="button" className="rounded border px-2 py-0.5" onClick={onOpenAssetBrowser}>
        Asset Browser
      </button>
    </div>
  );
}

/**
 * FAM-03 + VIE-02 — properties panel for a selected geometry node.
 *
 * Lists boolean params + an "always visible" sentinel. Selecting a
 * boolean param exposes a Show-when-true / Show-when-false toggle
 * (FAM-03). VIE-02 adds an independent 3-checkbox row for plan detail
 * levels (Coarse / Medium / Fine).
 */
function SweepPropertiesPanel({
  t,
  sweep,
  params,
  onUpdate,
  onUpdateMaterial,
  onOpenMaterialBrowser,
  onOpenAppearanceAssetBrowser,
  onUpdateDetailLevel,
}: SweepPropertiesPanelProps): JSX.Element {
  const booleanParams = params.filter((p) => p.type === 'boolean');
  const binding = sweep.visibilityBinding;
  const selected = binding ? binding.paramName : VISIBLE_ALWAYS;
  const whenTrue = binding ? binding.whenTrue : true;
  const detailVis = sweep.visibilityByDetailLevel;
  const detailVisible = (level: DetailLevelKey): boolean => detailVis?.[level] !== false;
  const material = resolveMaterial(sweep.materialKey);

  function onParamChange(value: string) {
    if (value === VISIBLE_ALWAYS) {
      onUpdate(undefined);
    } else {
      onUpdate({ paramName: value, whenTrue });
    }
  }

  function onWhenChange(next: boolean) {
    if (!binding) return;
    onUpdate({ paramName: binding.paramName, whenTrue: next });
  }

  return (
    <div
      className="border rounded p-3 space-y-2 mt-2"
      role="region"
      aria-label={t('familyEditor.geometryPropertiesAriaLabel')}
    >
      <h3 className="font-semibold text-sm">{t('familyEditor.geometryPropertiesHeading')}</h3>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="w-32">Material</span>
        <span
          className="h-5 w-5 rounded border border-border"
          style={{ backgroundColor: material?.baseColor ?? '#cccccc' }}
          aria-hidden="true"
        />
        <span data-testid="selected-sweep-material">
          {material ? material.displayName : (sweep.materialKey ?? 'None')}
        </span>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs"
          onClick={onOpenMaterialBrowser}
        >
          Browse
        </button>
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs"
          onClick={onOpenAppearanceAssetBrowser}
        >
          Asset Browser
        </button>
        {sweep.materialKey ? (
          <button
            type="button"
            className="rounded border px-2 py-0.5 text-xs"
            onClick={() => onUpdateMaterial(null)}
          >
            Clear
          </button>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <span className="w-32">{t('familyEditor.visibleWhenLabel')}</span>
        <select
          aria-label={t('familyEditor.visibleWhenLabel')}
          value={selected}
          onChange={(e) => onParamChange(e.target.value)}
        >
          <option value={VISIBLE_ALWAYS}>{t('familyEditor.visibleAlways')}</option>
          {booleanParams.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label || p.key}
            </option>
          ))}
        </select>
      </label>
      {binding && (
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="visibilityWhen"
              checked={whenTrue}
              onChange={() => onWhenChange(true)}
              aria-label={t('familyEditor.showWhenTrue')}
            />
            {t('familyEditor.showWhenTrue')}
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              name="visibilityWhen"
              checked={!whenTrue}
              onChange={() => onWhenChange(false)}
              aria-label={t('familyEditor.showWhenFalse')}
            />
            {t('familyEditor.showWhenFalse')}
          </label>
        </div>
      )}
      <div role="group" aria-label={t('familyEditor.visibilityByDetailHeading')}>
        <div className="text-sm font-medium">{t('familyEditor.visibilityByDetailHeading')}</div>
        <div className="flex gap-4 text-sm mt-1">
          {(['coarse', 'medium', 'fine'] as const).map((level) => {
            const labelKey = `familyEditor.visibilityDetail${level.charAt(0).toUpperCase() + level.slice(1)}`;
            return (
              <label key={level} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  aria-label={`visibility-${level}`}
                  checked={detailVisible(level)}
                  onChange={(e) => onUpdateDetailLevel(level, e.target.checked)}
                />
                {t(labelKey)}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ArrayDraftPanelProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  draft: ArrayDraft;
  params: Param[];
  onUpdate: (patch: Partial<ArrayDraft>) => void;
  onFinish: () => void;
  onCancel: () => void;
}

/**
 * FAM-05 — Array authoring panel.
 *
 * Click target → define axis (start/end mm) → set count param + spacing.
 * The Finish button is locked until both target and count param are
 * non-empty, plus a `totalLengthParam` when spacing is `fit_total`.
 */
function ArrayDraftPanel({
  t,
  draft,
  params,
  onUpdate,
  onFinish,
  onCancel,
}: ArrayDraftPanelProps): JSX.Element {
  const numericParams = params.filter((p) => p.type === 'length_mm' || p.type === 'angle_deg');
  const finishDisabled =
    !draft.targetFamilyId ||
    !draft.countParam ||
    (draft.spacingMode === 'fit_total' && !draft.totalLengthParam);

  return (
    <section
      className="border rounded p-3 space-y-2"
      aria-label={t('familyEditor.arraySketchAriaLabel')}
      role="dialog"
    >
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">{t('familyEditor.arrayHeading')}</h2>
        <button type="button" onClick={onCancel} className="ml-auto text-sm underline">
          {t('familyEditor.arrayCancel')}
        </button>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <span className="w-32">{t('familyEditor.arrayTargetLabel')}</span>
        <input
          aria-label={t('familyEditor.arrayTargetLabel')}
          value={draft.targetFamilyId}
          onChange={(e) => onUpdate({ targetFamilyId: e.target.value })}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="w-32">{t('familyEditor.arrayModeLabel')}</span>
        <select
          aria-label={t('familyEditor.arrayModeLabel')}
          value={draft.mode}
          onChange={(e) => onUpdate({ mode: e.target.value as 'linear' | 'radial' })}
        >
          <option value="linear">{t('familyEditor.arrayModeLinear')}</option>
          <option value="radial">{t('familyEditor.arrayModeRadial')}</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="w-32">{t('familyEditor.arrayCountParamLabel')}</span>
        <select
          aria-label={t('familyEditor.arrayCountParamLabel')}
          value={draft.countParam}
          onChange={(e) => onUpdate({ countParam: e.target.value })}
        >
          <option value="">—</option>
          {numericParams.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label || p.key}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <span className="w-32">{t('familyEditor.arraySpacingLabel')}</span>
        <select
          aria-label={t('familyEditor.arraySpacingLabel')}
          value={draft.spacingMode}
          onChange={(e) => onUpdate({ spacingMode: e.target.value as 'fixed_mm' | 'fit_total' })}
        >
          <option value="fixed_mm">{t('familyEditor.arraySpacingFixed')}</option>
          <option value="fit_total">{t('familyEditor.arraySpacingFitTotal')}</option>
        </select>
      </label>
      {draft.spacingMode === 'fixed_mm' ? (
        <label className="flex items-center gap-2 text-sm">
          <span className="w-32">{t('familyEditor.arraySpacingFixed')}</span>
          <input
            type="number"
            aria-label={t('familyEditor.arraySpacingFixed')}
            value={draft.fixedMm}
            onChange={(e) => onUpdate({ fixedMm: Number(e.target.value) })}
          />
        </label>
      ) : (
        <label className="flex items-center gap-2 text-sm">
          <span className="w-32">{t('familyEditor.arraySpacingFitTotal')}</span>
          <select
            aria-label={t('familyEditor.arraySpacingFitTotal')}
            value={draft.totalLengthParam}
            onChange={(e) => onUpdate({ totalLengthParam: e.target.value })}
          >
            <option value="">—</option>
            {numericParams.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label || p.key}
              </option>
            ))}
          </select>
        </label>
      )}
      <fieldset className="text-sm">
        <legend>{t('familyEditor.arrayAxisStartLabel')}</legend>
        <input
          type="number"
          aria-label="array-axis-start-x"
          value={draft.axisStart.xMm}
          onChange={(e) =>
            onUpdate({ axisStart: { ...draft.axisStart, xMm: Number(e.target.value) } })
          }
        />
        <input
          type="number"
          aria-label="array-axis-start-y"
          value={draft.axisStart.yMm}
          onChange={(e) =>
            onUpdate({ axisStart: { ...draft.axisStart, yMm: Number(e.target.value) } })
          }
        />
        <input
          type="number"
          aria-label="array-axis-start-z"
          value={draft.axisStart.zMm}
          onChange={(e) =>
            onUpdate({ axisStart: { ...draft.axisStart, zMm: Number(e.target.value) } })
          }
        />
      </fieldset>
      <fieldset className="text-sm">
        <legend>{t('familyEditor.arrayAxisEndLabel')}</legend>
        <input
          type="number"
          aria-label="array-axis-end-x"
          value={draft.axisEnd.xMm}
          onChange={(e) => onUpdate({ axisEnd: { ...draft.axisEnd, xMm: Number(e.target.value) } })}
        />
        <input
          type="number"
          aria-label="array-axis-end-y"
          value={draft.axisEnd.yMm}
          onChange={(e) => onUpdate({ axisEnd: { ...draft.axisEnd, yMm: Number(e.target.value) } })}
        />
        <input
          type="number"
          aria-label="array-axis-end-z"
          value={draft.axisEnd.zMm}
          onChange={(e) => onUpdate({ axisEnd: { ...draft.axisEnd, zMm: Number(e.target.value) } })}
        />
      </fieldset>
      <button
        type="button"
        onClick={onFinish}
        disabled={finishDisabled}
        className="bg-accent text-accent-foreground px-3 py-1 rounded text-sm disabled:opacity-50 hover:opacity-90"
      >
        {t('familyEditor.arrayFinish')}
      </button>
    </section>
  );
}

interface SweepSketchProps {
  t: (key: string) => string;
  lines: SketchLine[];
  onAppendLine: (line: SketchLine) => void;
}

interface PathSketchProps extends SweepSketchProps {
  onAdvance: () => void;
}

function SweepPathSketch({ t, lines, onAppendLine, onAdvance }: PathSketchProps): JSX.Element {
  const [draft, setDraft] = useState({ sx: 0, sy: 0, ex: 100, ey: 0 });
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted">{t('familyEditor.sweepPathHint')}</div>
      <ul className="text-xs space-y-1" data-testid="sweep-path-list">
        {lines.map((l, i) => (
          <li key={i}>
            ({l.startMm.xMm}, {l.startMm.yMm}) → ({l.endMm.xMm}, {l.endMm.yMm})
          </li>
        ))}
      </ul>
      <div className="flex gap-2 items-center text-xs">
        <input
          type="number"
          aria-label="path-sx"
          value={draft.sx}
          onChange={(e) => setDraft({ ...draft, sx: Number(e.target.value) })}
        />
        <input
          type="number"
          aria-label="path-sy"
          value={draft.sy}
          onChange={(e) => setDraft({ ...draft, sy: Number(e.target.value) })}
        />
        →
        <input
          type="number"
          aria-label="path-ex"
          value={draft.ex}
          onChange={(e) => setDraft({ ...draft, ex: Number(e.target.value) })}
        />
        <input
          type="number"
          aria-label="path-ey"
          value={draft.ey}
          onChange={(e) => setDraft({ ...draft, ey: Number(e.target.value) })}
        />
        <button
          type="button"
          onClick={() =>
            onAppendLine({
              startMm: { xMm: draft.sx, yMm: draft.sy },
              endMm: { xMm: draft.ex, yMm: draft.ey },
            })
          }
        >
          {t('familyEditor.sweepAddLine')}
        </button>
      </div>
      <button
        type="button"
        onClick={onAdvance}
        disabled={lines.length === 0}
        className="bg-accent text-accent-foreground px-3 py-1 rounded text-sm disabled:opacity-50 hover:opacity-90"
      >
        {t('familyEditor.sweepEditProfile')}
      </button>
    </div>
  );
}

interface ProfileSketchProps extends SweepSketchProps {
  refPlanes: RefPlane[];
  onPickReferencePlane: (planeId: string, locked: boolean) => void;
  onTrimExtend: (firstIndex: number, secondIndex: number) => void;
  onFinish: () => void;
}

function SweepProfileSketch({
  t,
  lines,
  refPlanes,
  onAppendLine,
  onPickReferencePlane,
  onTrimExtend,
  onFinish,
}: ProfileSketchProps): JSX.Element {
  const [draft, setDraft] = useState({ sx: 0, sy: 0, ex: 50, ey: 0 });
  const [lockPicked, setLockPicked] = useState(true);
  const [pickPlaneId, setPickPlaneId] = useState('');
  const [trimFirstIndex, setTrimFirstIndex] = useState(0);
  const [trimSecondIndex, setTrimSecondIndex] = useState(1);
  const selectedPickPlaneId = pickPlaneId || refPlanes[0]?.id || '';
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted">{t('familyEditor.sweepProfileHint')}</div>
      <ul className="text-xs space-y-1" data-testid="sweep-profile-list">
        {lines.map((l, i) => (
          <li key={i}>
            ({l.startMm.xMm}, {l.startMm.yMm}) → ({l.endMm.xMm}, {l.endMm.yMm})
            {l.locked ? <span> · locked</span> : null}
          </li>
        ))}
      </ul>
      {refPlanes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            Pick Lines
            <select
              aria-label="profile-pick-reference-plane"
              value={selectedPickPlaneId}
              onChange={(e) => setPickPlaneId(e.target.value)}
              className="rounded border px-1 py-0.5"
            >
              {refPlanes.map((plane) => (
                <option key={plane.id} value={plane.id}>
                  {plane.name} {plane.isVertical ? 'V' : 'H'} {plane.offsetMm}mm
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              aria-label="profile-pick-lock"
              checked={lockPicked}
              onChange={(e) => setLockPicked(e.target.checked)}
            />
            Lock
          </label>
          <button
            type="button"
            data-testid="profile-pick-reference-plane"
            onClick={() => {
              if (selectedPickPlaneId) onPickReferencePlane(selectedPickPlaneId, lockPicked);
            }}
          >
            Pick
          </button>
        </div>
      ) : null}
      <div className="flex gap-2 items-center text-xs">
        <input
          type="number"
          aria-label="profile-sx"
          value={draft.sx}
          onChange={(e) => setDraft({ ...draft, sx: Number(e.target.value) })}
        />
        <input
          type="number"
          aria-label="profile-sy"
          value={draft.sy}
          onChange={(e) => setDraft({ ...draft, sy: Number(e.target.value) })}
        />
        →
        <input
          type="number"
          aria-label="profile-ex"
          value={draft.ex}
          onChange={(e) => setDraft({ ...draft, ex: Number(e.target.value) })}
        />
        <input
          type="number"
          aria-label="profile-ey"
          value={draft.ey}
          onChange={(e) => setDraft({ ...draft, ey: Number(e.target.value) })}
        />
        <button
          type="button"
          onClick={() =>
            onAppendLine({
              startMm: { xMm: draft.sx, yMm: draft.sy },
              endMm: { xMm: draft.ex, yMm: draft.ey },
            })
          }
        >
          {t('familyEditor.sweepAddLine')}
        </button>
      </div>
      {lines.length >= 2 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span>Trim/Extend</span>
          <select
            aria-label="profile-trim-first-line"
            value={trimFirstIndex}
            onChange={(e) => setTrimFirstIndex(Number(e.target.value))}
            className="rounded border px-1 py-0.5"
          >
            {lines.map((_line, index) => (
              <option key={index} value={index}>
                Line {index + 1}
              </option>
            ))}
          </select>
          <select
            aria-label="profile-trim-second-line"
            value={trimSecondIndex}
            onChange={(e) => setTrimSecondIndex(Number(e.target.value))}
            className="rounded border px-1 py-0.5"
          >
            {lines.map((_line, index) => (
              <option key={index} value={index}>
                Line {index + 1}
              </option>
            ))}
          </select>
          <button
            type="button"
            data-testid="profile-trim-extend"
            disabled={trimFirstIndex === trimSecondIndex}
            onClick={() => onTrimExtend(trimFirstIndex, trimSecondIndex)}
          >
            TR
          </button>
        </div>
      ) : null}
      <button
        type="button"
        onClick={onFinish}
        disabled={lines.length < 3}
        className="bg-accent text-accent-foreground px-3 py-1 rounded text-sm disabled:opacity-50 hover:opacity-90"
      >
        {t('familyEditor.sweepFinish')}
      </button>
    </div>
  );
}
