import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  ArrayGeometryNode,
  FamilyParamDef,
  SketchLine,
  SweepGeometryNode,
  VisibilityBinding,
  VisibilityByDetailLevel,
} from '../families/types';
import { validateFormula } from '../lib/expressionEvaluator';

/** VIE-02 — plan detail levels usable for per-node visibility binding. */
type DetailLevelKey = 'coarse' | 'medium' | 'fine';

type Template = 'generic_model' | 'door' | 'window' | 'profile';

type RefPlane = {
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

const EMPTY_SWEEP_DRAFT: SweepDraft = {
  pathLines: [],
  profile: [],
  profilePlane: 'normal_to_path_start',
  step: 'path',
};

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

export function FamilyEditorWorkbench(): JSX.Element {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<Template>('generic_model');
  const [refPlanes, setRefPlanes] = useState<RefPlane[]>([]);
  const [params, setParams] = useState<Param[]>([]);
  const [flexMode, setFlexMode] = useState(false);
  const [flexValues, setFlexValues] = useState<Record<string, unknown>>({});
  const [sweeps, setSweeps] = useState<SweepGeometryNode[]>([]);
  const [sweepDraft, setSweepDraft] = useState<SweepDraft | null>(null);
  const [selectedSweepIndex, setSelectedSweepIndex] = useState<number | null>(null);
  const [arrays, setArrays] = useState<ArrayGeometryNode[]>([]);
  const [arrayDraft, setArrayDraft] = useState<ArrayDraft | null>(null);

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

  // Resolved parameter values for the canvas — defaults when flex mode
  // is off, defaults-merged-with-flex-overrides when on.
  const resolved = useMemo(() => {
    const overrides = flexMode ? flexValues : undefined;
    const map: Record<string, unknown> = {};
    for (const param of params) {
      map[param.key] = resolveFamilyParamValue(param, overrides);
    }
    return map;
  }, [params, flexMode, flexValues]);

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
            key={value}
            className={
              template === value
                ? 'bg-primary text-white px-3 py-1 rounded'
                : 'px-3 py-1 rounded border'
            }
            onClick={() => setTemplate(value)}
          >
            {label}
          </button>
        ))}
        <button
          className="px-3 py-1 rounded border ml-auto"
          onClick={startSweep}
          disabled={sweepDraft !== null}
          aria-label={t('familyEditor.sweepToggle')}
        >
          {t('familyEditor.sweepToggle')}
        </button>
        <button
          className="px-3 py-1 rounded border"
          onClick={startArray}
          disabled={arrayDraft !== null}
          aria-label={t('familyEditor.arrayToggle')}
        >
          {t('familyEditor.arrayToggle')}
        </button>
        <button
          className={
            flexMode ? 'bg-warning text-white px-3 py-1 rounded' : 'px-3 py-1 rounded border'
          }
          onClick={toggleFlexMode}
          aria-pressed={flexMode}
        >
          {t('familyEditor.flexToggle')}
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
            <button onClick={cancelSweep} className="ml-auto text-sm underline">
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
              onAppendLine={appendSweepProfileLine}
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
          {refPlanes.map((plane) => (
            <li key={plane.id} className="flex gap-4">
              <span>{plane.name}</span>
              <span>{plane.isVertical ? 'V' : 'H'}</span>
              <span>{plane.offsetMm} mm</span>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button onClick={() => addRefPlane(false)}>{t('familyEditor.addHorizontal')}</button>
          <button onClick={() => addRefPlane(true)}>{t('familyEditor.addVertical')}</button>
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
        <button onClick={addParam}>{t('familyEditor.addParameter')}</button>
      </section>

      {flexMode && (
        <section
          aria-label={t('familyEditor.flexSidebarAriaLabel')}
          className="border rounded p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{t('familyEditor.flexHeading')}</h2>
            <button onClick={resetFlexValues} className="ml-auto text-sm underline">
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

      <button
        onClick={() =>
          console.warn('load-into-project stub', { template, refPlanes, params, resolved, sweeps })
        }
      >
        {t('familyEditor.loadIntoProject')}
      </button>
    </div>
  );
}

interface SweepPropertiesPanelProps {
  t: (key: string, opts?: Record<string, unknown>) => string;
  sweep: SweepGeometryNode;
  params: Param[];
  onUpdate: (binding: VisibilityBinding | undefined) => void;
  onUpdateDetailLevel: (level: DetailLevelKey, visible: boolean) => void;
}

const VISIBLE_ALWAYS = '__always__';

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
  onUpdateDetailLevel,
}: SweepPropertiesPanelProps): JSX.Element {
  const booleanParams = params.filter((p) => p.type === 'boolean');
  const binding = sweep.visibilityBinding;
  const selected = binding ? binding.paramName : VISIBLE_ALWAYS;
  const whenTrue = binding ? binding.whenTrue : true;
  const detailVis = sweep.visibilityByDetailLevel;
  const detailVisible = (level: DetailLevelKey): boolean => detailVis?.[level] !== false;

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
        <button onClick={onCancel} className="ml-auto text-sm underline">
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
        onClick={onFinish}
        disabled={finishDisabled}
        className="bg-primary text-white px-3 py-1 rounded text-sm disabled:opacity-50"
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
        onClick={onAdvance}
        disabled={lines.length === 0}
        className="bg-primary text-white px-3 py-1 rounded text-sm disabled:opacity-50"
      >
        {t('familyEditor.sweepEditProfile')}
      </button>
    </div>
  );
}

interface ProfileSketchProps extends SweepSketchProps {
  onFinish: () => void;
}

function SweepProfileSketch({ t, lines, onAppendLine, onFinish }: ProfileSketchProps): JSX.Element {
  const [draft, setDraft] = useState({ sx: 0, sy: 0, ex: 50, ey: 0 });
  return (
    <div className="space-y-2">
      <div className="text-xs text-muted">{t('familyEditor.sweepProfileHint')}</div>
      <ul className="text-xs space-y-1" data-testid="sweep-profile-list">
        {lines.map((l, i) => (
          <li key={i}>
            ({l.startMm.xMm}, {l.startMm.yMm}) → ({l.endMm.xMm}, {l.endMm.yMm})
          </li>
        ))}
      </ul>
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
        onClick={onFinish}
        disabled={lines.length < 3}
        className="bg-primary text-white px-3 py-1 rounded text-sm disabled:opacity-50"
      >
        {t('familyEditor.sweepFinish')}
      </button>
    </div>
  );
}
