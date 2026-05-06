import { useMemo, useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { FamilyParamDef, SketchLine, SweepGeometryNode } from '../families/types';
import { validateFormula } from '../lib/expressionEvaluator';

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

export function FamilyEditorWorkbench(): JSX.Element {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<Template>('generic_model');
  const [refPlanes, setRefPlanes] = useState<RefPlane[]>([]);
  const [params, setParams] = useState<Param[]>([]);
  const [flexMode, setFlexMode] = useState(false);
  const [flexValues, setFlexValues] = useState<Record<string, unknown>>({});
  const [sweeps, setSweeps] = useState<SweepGeometryNode[]>([]);
  const [sweepDraft, setSweepDraft] = useState<SweepDraft | null>(null);

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
          className={
            flexMode ? 'bg-warning text-white px-3 py-1 rounded' : 'px-3 py-1 rounded border'
          }
          onClick={toggleFlexMode}
          aria-pressed={flexMode}
        >
          {t('familyEditor.flexToggle')}
        </button>
      </div>

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
                {t('familyEditor.sweepLabel', {
                  index: i + 1,
                  pathSegs: s.pathLines.length,
                  profSegs: s.profile.length,
                })}
              </li>
            ))}
          </ul>
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
