import { useState, type JSX } from 'react';
import type { FamilyParamDef, SketchLine } from '../families/types';
import { resolveMaterial } from '../viewport/materials';

type Param = {
  key: string;
  label: string;
  type: FamilyParamDef['type'];
  default: unknown;
  formula: string;
  instanceOverridable: boolean;
};

type FamilyTypeRow = {
  id: string;
  name: string;
  values: Record<string, unknown>;
};

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

type ProfileRefPlane = {
  id: string;
  name: string;
  isVertical: boolean;
  offsetMm: number;
};

function parseFamilyTypeValue(param: Param, raw: string): unknown {
  if (param.type === 'length_mm' || param.type === 'angle_deg') {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : raw;
  }
  if (param.type === 'boolean') return raw === 'true';
  return raw;
}

export function FamilyTypesDialog({
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
                  <th className="text-left">Scope</th>
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
                      <td>{param.instanceOverridable ? 'Instance' : 'Type'}</td>
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

export function MaterialDefaultEditor({
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
        style={{ backgroundColor: material?.baseColor ?? 'var(--color-surface-strong)' }}
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
export function ArrayDraftPanel({
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

export function SweepPathSketch({
  t,
  lines,
  onAppendLine,
  onAdvance,
}: PathSketchProps): JSX.Element {
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
  refPlanes: ProfileRefPlane[];
  familyGeometryLines: SketchLine[];
  onPickReferencePlane: (planeId: string, locked: boolean) => void;
  onPickFamilyGeometry: (index: number, locked: boolean) => void;
  onAppendCircle: (
    centerXMm: number,
    centerYMm: number,
    radiusMm: number,
    radiusParam: string,
  ) => void;
  onCopyCircle: (dxMm: number, dyMm: number) => void;
  onTrimExtend: (firstIndex: number, secondIndex: number) => void;
  onFinish: () => void;
}

export function SweepProfileSketch({
  t,
  lines,
  refPlanes,
  familyGeometryLines,
  onAppendLine,
  onPickReferencePlane,
  onPickFamilyGeometry,
  onAppendCircle,
  onCopyCircle,
  onTrimExtend,
  onFinish,
}: ProfileSketchProps): JSX.Element {
  const [draft, setDraft] = useState({ sx: 0, sy: 0, ex: 50, ey: 0 });
  const [circleDraft, setCircleDraft] = useState({
    cx: 0,
    cy: 0,
    radius: 25,
    radiusParam: 'Leg_Radius',
    copyDx: 400,
    copyDy: 0,
  });
  const [lockPicked, setLockPicked] = useState(true);
  const [pickPlaneId, setPickPlaneId] = useState('');
  const [pickFamilyGeometryIndex, setPickFamilyGeometryIndex] = useState(0);
  const [trimFirstIndex, setTrimFirstIndex] = useState(0);
  const [trimSecondIndex, setTrimSecondIndex] = useState(1);
  const [trimShortcutArmed, setTrimShortcutArmed] = useState(false);
  const selectedPickPlaneId = pickPlaneId || refPlanes[0]?.id || '';
  function commitTrimExtend() {
    if (trimFirstIndex !== trimSecondIndex) {
      onTrimExtend(trimFirstIndex, trimSecondIndex);
    }
  }
  return (
    <div
      className="space-y-2"
      tabIndex={0}
      aria-label="Sweep profile sketch"
      onKeyDown={(e) => {
        const tagName = (e.target as HTMLElement).tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'select' || tagName === 'button') return;
        const key = e.key.toLowerCase();
        if (key === 't') {
          setTrimShortcutArmed(true);
          return;
        }
        if (trimShortcutArmed && key === 'r') {
          e.preventDefault();
          commitTrimExtend();
          setTrimShortcutArmed(false);
          return;
        }
        setTrimShortcutArmed(false);
      }}
    >
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
      {familyGeometryLines.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1">
            Pick Family Edge
            <select
              aria-label="profile-pick-family-edge"
              value={pickFamilyGeometryIndex}
              onChange={(e) => setPickFamilyGeometryIndex(Number(e.target.value))}
              className="rounded border px-1 py-0.5"
            >
              {familyGeometryLines.map((line, index) => (
                <option key={index} value={index}>
                  Edge {index + 1} ({line.startMm.xMm},{line.startMm.yMm}) → ({line.endMm.xMm},
                  {line.endMm.yMm})
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="profile-pick-family-edge"
            onClick={() => onPickFamilyGeometry(pickFamilyGeometryIndex, lockPicked)}
          >
            Pick Edge
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
      <div className="flex flex-wrap items-center gap-2 rounded border border-border p-2 text-xs">
        <span>Circle</span>
        <input
          type="number"
          aria-label="circle-center-x"
          value={circleDraft.cx}
          onChange={(e) => setCircleDraft({ ...circleDraft, cx: Number(e.target.value) })}
        />
        <input
          type="number"
          aria-label="circle-center-y"
          value={circleDraft.cy}
          onChange={(e) => setCircleDraft({ ...circleDraft, cy: Number(e.target.value) })}
        />
        <input
          type="number"
          aria-label="circle-radius"
          value={circleDraft.radius}
          onChange={(e) => setCircleDraft({ ...circleDraft, radius: Number(e.target.value) })}
        />
        <input
          aria-label="circle-radius-parameter"
          value={circleDraft.radiusParam}
          onChange={(e) => setCircleDraft({ ...circleDraft, radiusParam: e.target.value })}
        />
        <button
          type="button"
          data-testid="profile-add-circle"
          onClick={() =>
            onAppendCircle(
              circleDraft.cx,
              circleDraft.cy,
              circleDraft.radius,
              circleDraft.radiusParam || 'Leg_Radius',
            )
          }
        >
          Add circle
        </button>
        <span>Copy</span>
        <input
          type="number"
          aria-label="circle-copy-dx"
          value={circleDraft.copyDx}
          onChange={(e) => setCircleDraft({ ...circleDraft, copyDx: Number(e.target.value) })}
        />
        <input
          type="number"
          aria-label="circle-copy-dy"
          value={circleDraft.copyDy}
          onChange={(e) => setCircleDraft({ ...circleDraft, copyDy: Number(e.target.value) })}
        />
        <button
          type="button"
          data-testid="profile-copy-circle"
          onClick={() => onCopyCircle(circleDraft.copyDx, circleDraft.copyDy)}
        >
          Copy circle
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
            onClick={commitTrimExtend}
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
