import { useState, type JSX } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import type { Element } from '@bim-ai/core';

import { BUILT_IN_FAMILIES, getFamilyById, getTypeById } from '../families/familyCatalog';

import { planViewGraphicsMatrixRows, viewTemplateGraphicsMatrixRows } from '../plan/planProjection';
import { PlanViewGraphicsMatrix } from './PlanViewGraphicsMatrix';
import {
  SavedViewTagGraphicsAuthoring,
  SavedViewTemplateGraphicsAuthoring,
} from './savedViewTagGraphicsAuthoring';

/**
 * Inspector parameter renderers — spec §13.
 *
 * Read-only field panels per element kind. The Apply / Reset footer is
 * left to the controlling Inspector component (which only shows it when
 * dirty=true). Numeric writes through the engine command pipeline land
 * separately when the redesigned palette gains drawing flow.
 */

interface FieldRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

export function FieldRow({ label, value, mono }: FieldRowProps): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-1.5 last:border-b-0">
      <span className="text-xs text-muted">{label}</span>
      <span className={['text-sm text-foreground', mono ? 'font-mono text-xs' : ''].join(' ')}>
        {value}
      </span>
    </div>
  );
}

function fmtMm(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} m`;
  return `${value.toFixed(0)} mm`;
}

export function InspectorPropertiesFor(el: Element, t: TFunction): JSX.Element {
  const f = (key: string) => t(`inspector.fields.${key}`);
  switch (el.kind) {
    case 'wall':
      return (
        <div>
          <FieldRow label={f('type')} value="Generic — wall" />
          <FieldRow label={f('thickness')} value={fmtMm(el.thicknessMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label={f('level')} value={el.levelId} mono />
          <FieldRow label={f('start')} value={`${fmtMm(el.start.xMm)} · ${fmtMm(el.start.yMm)}`} mono />
          <FieldRow label={f('end')} value={`${fmtMm(el.end.xMm)} · ${fmtMm(el.end.yMm)}`} mono />
        </div>
      );
    case 'door':
      return (
        <div>
          <FieldRow label={f('family')} value={el.familyTypeId ?? 'Generic 900 × 2100'} mono />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('wall')} value={el.wallId} mono />
          <FieldRow label={f('alongT')} value={el.alongT.toFixed(3)} mono />
        </div>
      );
    case 'window':
      return (
        <div>
          <FieldRow label={f('family')} value={el.familyTypeId ?? 'Generic 1200 × 1500'} mono />
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
          <FieldRow label={f('sillHeight')} value={fmtMm(el.sillHeightMm)} />
          <FieldRow label={f('wall')} value={el.wallId} mono />
        </div>
      );
    case 'floor':
      return (
        <div>
          <FieldRow label={f('type')} value={el.floorTypeId ?? 'Generic 220 mm slab'} mono />
          <FieldRow label={f('thickness')} value={fmtMm(el.thicknessMm)} />
          <FieldRow label={f('structureThickness')} value={fmtMm(el.structureThicknessMm)} />
          <FieldRow label={f('finishThickness')} value={fmtMm(el.finishThicknessMm)} />
          <FieldRow label={f('level')} value={el.levelId} mono />
          <FieldRow label={f('boundaryPoints')} value={String(el.boundaryMm.length)} />
        </div>
      );
    case 'roof':
      return (
        <div>
          <FieldRow label={f('type')} value={el.roofTypeId ?? 'Generic gable'} mono />
          <FieldRow label={f('slope')} value={`${(el.slopeDeg ?? 0).toFixed(1)}°`} />
          <FieldRow label={f('overhang')} value={fmtMm(el.overhangMm)} />
          <FieldRow label={f('referenceLevel')} value={el.referenceLevelId} mono />
          <FieldRow label={f('footprintPoints')} value={String(el.footprintMm.length)} />
        </div>
      );
    case 'stair':
      return (
        <div>
          <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
          <FieldRow label={f('riser')} value={fmtMm(el.riserMm)} />
          <FieldRow label={f('tread')} value={fmtMm(el.treadMm)} />
          <FieldRow label={f('baseLevel')} value={el.baseLevelId} mono />
          <FieldRow label={f('topLevel')} value={el.topLevelId} mono />
        </div>
      );
    case 'room':
      return (
        <div>
          <FieldRow label={f('programme')} value={el.programmeCode ?? '—'} />
          <FieldRow label={f('department')} value={el.department ?? '—'} />
          <FieldRow label={f('function')} value={el.functionLabel ?? '—'} />
          <FieldRow label={f('finishSet')} value={el.finishSet ?? '—'} />
          <FieldRow label={f('level')} value={el.levelId} mono />
          <FieldRow label={f('outlinePoints')} value={String(el.outlineMm.length)} />
        </div>
      );
    case 'level':
      return (
        <div>
          <FieldRow label={f('elevation')} value={fmtMm(el.elevationMm)} />
          <FieldRow label={f('datumKind')} value={el.datumKind ?? '—'} mono />
        </div>
      );
    case 'section_cut':
      return (
        <div>
          <FieldRow
            label={f('lineStart')}
            value={`${fmtMm(el.lineStartMm.xMm)} · ${fmtMm(el.lineStartMm.yMm)}`}
            mono
          />
          <FieldRow
            label={f('lineEnd')}
            value={`${fmtMm(el.lineEndMm.xMm)} · ${fmtMm(el.lineEndMm.yMm)}`}
            mono
          />
          <FieldRow label={f('cropDepth')} value={fmtMm(el.cropDepthMm)} />
        </div>
      );
    case 'plan_view':
      return (
        <div>
          <FieldRow label={f('level')} value={el.levelId} mono />
          <FieldRow label={f('presentation')} value={el.planPresentation ?? 'default'} />
          {el.viewTemplateId ? <FieldRow label={f('template')} value={el.viewTemplateId} mono /> : null}
          {el.underlayLevelId ? <FieldRow label={f('underlay')} value={el.underlayLevelId} mono /> : null}
        </div>
      );
    case 'viewpoint':
      return (
        <div>
          <FieldRow label={f('name')} value={el.name} />
          <FieldRow label={f('id')} value={el.id} mono />
        </div>
      );
    case 'view_template':
      return (
        <div>
          <FieldRow label={f('scale')} value={el.scale} mono />
          {el.planDetailLevel ? <FieldRow label={f('detailLevel')} value={el.planDetailLevel} /> : null}
        </div>
      );
    default:
      return <p className="text-sm text-muted">{t('inspector.noParams', { kind: el.kind })}</p>;
  }
}

export function InspectorConstraintsFor(el: Element, t: TFunction): JSX.Element {
  const f = (key: string) => t(`inspector.fields.${key}`);
  switch (el.kind) {
    case 'wall':
      return (
        <div>
          <FieldRow label={f('wallJoin')} value="Auto" />
          <FieldRow label={f('wrapRule')} value="Default" />
          <FieldRow label={f('roomBounding')} value="Yes" />
          <FieldRow label={f('locationLine')} value="Wall centerline" />
        </div>
      );
    case 'floor':
      return (
        <div>
          <FieldRow label={f('roomBounding')} value={el.roomBounded ? 'Yes' : 'No'} />
          <FieldRow label={f('slabTopElevation')} value="(derived)" />
        </div>
      );
    case 'roof':
      return (
        <div>
          <FieldRow label={f('geometryMode')} value={el.roofGeometryMode ?? 'mass_box'} mono />
        </div>
      );
    default:
      return <p className="text-sm text-muted">{t('inspector.noConstraints', { kind: el.kind })}</p>;
  }
}

export function InspectorIdentityFor(el: Element, t: TFunction): JSX.Element {
  const f = (key: string) => t(`inspector.fields.${key}`);
  return (
    <div>
      <FieldRow label={f('kind')} value={el.kind} mono />
      <FieldRow label={f('id')} value={el.id} mono />
      <FieldRow label={f('name')} value={(el as { name?: string }).name ?? '—'} />
      <FieldRow label={f('mark')} value={(el as { mark?: string }).mark ?? '—'} />
      <FieldRow label={f('comments')} value={(el as { comments?: string }).comments ?? '—'} />
    </div>
  );
}

export function InspectorGraphicsFor({
  el,
  elementsById,
  revision,
  onPersistProperty,
}: {
  el: Element;
  elementsById: Record<string, Element>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element | null {
  if (el.kind === 'plan_view') {
    const rows = planViewGraphicsMatrixRows(elementsById, el.id);
    return (
      <div className="flex flex-col gap-4">
        <PlanViewGraphicsMatrix rows={rows} />
        <SavedViewTagGraphicsAuthoring
          variant="plan_view"
          selected={el as Extract<Element, { kind: 'plan_view' }>}
          revision={revision}
          elementsById={elementsById}
          onPersistProperty={onPersistProperty}
        />
      </div>
    );
  }
  if (el.kind === 'view_template') {
    const rows = viewTemplateGraphicsMatrixRows(elementsById, el.id);
    return (
      <div className="flex flex-col gap-4">
        <PlanViewGraphicsMatrix
          rows={rows}
          footnote="Template defaults — plan_view overrides these when linked."
        />
        <SavedViewTemplateGraphicsAuthoring
          selected={el as Extract<Element, { kind: 'view_template' }>}
          revision={revision}
          elementsById={elementsById}
          onPersistProperty={onPersistProperty}
        />
      </div>
    );
  }
  return null;
}

const INPUT_CLS =
  'mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]';
const LABEL_CLS = 'block text-[10px] text-muted';

/** Editable inspector for plan_view elements (Properties tab). */
export function InspectorPlanViewEditor({
  el,
  elementsById,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'plan_view' }>;
  elementsById: Record<string, Element>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const levels = (Object.values(elementsById) as Element[]).filter(
    (e): e is Extract<Element, { kind: 'level' }> => e.kind === 'level',
  );
  const templates = (Object.values(elementsById) as Element[]).filter(
    (e): e is Extract<Element, { kind: 'view_template' }> => e.kind === 'view_template',
  );

  const { t } = useTranslation();
  const pv = (key: string) => t(`inspector.planView.${key}`);

  const [cropDraft, setCropDraft] = useState({
    minX: el.cropMinMm ? String(el.cropMinMm.xMm) : '',
    minY: el.cropMinMm ? String(el.cropMinMm.yMm) : '',
    maxX: el.cropMaxMm ? String(el.cropMaxMm.xMm) : '',
    maxY: el.cropMaxMm ? String(el.cropMaxMm.yMm) : '',
  });

  return (
    <div className="space-y-2 text-[11px]">
      <label className={LABEL_CLS}>
        {pv('namePlaceholder')}
        <input
          className={INPUT_CLS}
          defaultValue={el.name}
          key={`pv-name-${el.id}-${el.name}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || v === el.name) return;
            onPersistProperty('name', v);
          }}
        />
      </label>

      <label className={LABEL_CLS}>
        {pv('planPresentation')}
        <select
          className={INPUT_CLS}
          value={el.planPresentation ?? 'default'}
          onChange={(e) => onPersistProperty('planPresentation', e.target.value)}
        >
          <option value="default">{pv('neutralPresentation')}</option>
          <option value="opening_focus">{pv('openingFocus')}</option>
          <option value="room_scheme">{pv('roomScheme')}</option>
        </select>
      </label>

      <label className={LABEL_CLS}>
        {pv('underlayLevel')}
        <select
          className={INPUT_CLS}
          value={el.underlayLevelId && levels.some((l) => l.id === el.underlayLevelId) ? el.underlayLevelId : ''}
          onChange={(e) => onPersistProperty('underlayLevelId', e.target.value)}
        >
          <option value="">{pv('none')}</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>

      {templates.length > 0 ? (
        <>
          <label className={LABEL_CLS}>
            {pv('viewTemplateLink')}
            <select
              className={INPUT_CLS}
              value={el.viewTemplateId && templates.some((tmpl) => tmpl.id === el.viewTemplateId) ? el.viewTemplateId : ''}
              onChange={(e) => onPersistProperty('viewTemplateId', e.target.value)}
            >
              <option value="">{pv('none')}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
              ))}
            </select>
          </label>
          <label className={LABEL_CLS}>
            {pv('applyTemplate')}
            <select
              className={INPUT_CLS}
              value=""
              onChange={(e) => {
                const tid = e.target.value;
                if (!tid) return;
                onPersistProperty('__applyTemplate__', JSON.stringify({ planViewId: el.id, templateId: tid }));
              }}
            >
              <option value="">{pv('selectToApply')}</option>
              {templates.map((tmpl) => (
                <option key={tmpl.id} value={tmpl.id}>{tmpl.name}</option>
              ))}
            </select>
          </label>
        </>
      ) : null}

      <div className="border-t border-border pt-2 space-y-2">
        <div className="font-semibold text-muted">{pv('crop')}</div>
        <div className="grid grid-cols-2 gap-2">
          {(['minX', 'minY', 'maxX', 'maxY'] as const).map((k) => (
            <label key={k} className={LABEL_CLS}>
              {k}
              <input
                className={INPUT_CLS}
                value={cropDraft[k]}
                onChange={(e) => setCropDraft((d) => ({ ...d, [k]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-[10px] hover:bg-surface-strong"
            onClick={() => {
              const nx = Number(cropDraft.minX), ny = Number(cropDraft.minY);
              const xx = Number(cropDraft.maxX), xy = Number(cropDraft.maxY);
              if (![nx, ny, xx, xy].every(Number.isFinite)) return;
              onPersistProperty('cropMinMm', JSON.stringify({ xMm: nx, yMm: ny }));
              onPersistProperty('cropMaxMm', JSON.stringify({ xMm: xx, yMm: xy }));
            }}
          >
            {pv('applyCrop')}
          </button>
          <button
            type="button"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-[10px] hover:bg-surface-strong"
            onClick={() => {
              onPersistProperty('cropMinMm', '');
              onPersistProperty('cropMaxMm', '');
              setCropDraft({ minX: '', minY: '', maxX: '', maxY: '' });
            }}
          >
            {pv('clearCrop')}
          </button>
        </div>
      </div>

      <div className="border-t border-border pt-2 space-y-2">
        <div className="font-semibold text-muted">{pv('viewRange')}</div>
        {(
          [
            { key: 'viewRangeBottomMm', label: pv('rangeBottom'), val: el.viewRangeBottomMm },
            { key: 'viewRangeTopMm', label: pv('rangeTop'), val: el.viewRangeTopMm },
            { key: 'cutPlaneOffsetMm', label: pv('cutPlaneOffset'), val: el.cutPlaneOffsetMm },
          ] as { key: string; label: string; val: number | null | undefined }[]
        ).map(({ key, label, val }) => (
          <label key={key} className={LABEL_CLS}>
            {label}
            <input
              className={INPUT_CLS}
              defaultValue={val == null ? '' : String(val)}
              key={`${key}-${el.id}-${val ?? 'null'}-${revision}`}
              placeholder={pv('emptyClearsPlaceholder')}
              inputMode="decimal"
              onBlur={(e) => onPersistProperty(key, e.target.value.trim())}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/** Editable inspector for room elements (Properties tab). */
export function InspectorRoomEditor({
  el,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'room' }>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const f = (key: string) => t(`inspector.fields.${key}`);
  const r = (key: string) => t(`inspector.room.${key}`);
  const fields: { key: string; label: string; val: string | null | undefined; inputMode?: string }[] = [
    { key: 'name', label: f('name'), val: el.name },
    { key: 'programmeCode', label: r('programmeCode'), val: el.programmeCode },
    { key: 'department', label: f('department'), val: el.department },
    { key: 'functionLabel', label: r('functionLabel'), val: el.functionLabel },
    { key: 'finishSet', label: f('finishSet'), val: el.finishSet },
  ];

  return (
    <div className="space-y-2 text-[11px]">
      {fields.map(({ key, label, val }) => (
        <label key={key} className={LABEL_CLS}>
          {label}
          <input
            className={INPUT_CLS}
            defaultValue={val ?? ''}
            key={`rm-${key}-${el.id}-${val ?? ''}-${revision}`}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (key === 'name' && (!v || v === val)) return;
              onPersistProperty(key, v);
            }}
          />
        </label>
      ))}
      <label className={LABEL_CLS}>
        {r('targetArea')}
        <input
          className={INPUT_CLS}
          defaultValue={el.targetAreaM2 == null ? '' : String(el.targetAreaM2)}
          key={`rm-tgt-${el.id}-${el.targetAreaM2 ?? 'x'}-${revision}`}
          placeholder={r('optional')}
          inputMode="decimal"
          onBlur={(e) => onPersistProperty('targetAreaM2', e.target.value.trim())}
        />
      </label>
      <FieldRow label={f('level')} value={el.levelId} mono />
      <FieldRow label={f('outlinePoints')} value={String(el.outlineMm.length)} />
    </div>
  );
}

/** Editable name field for viewpoint elements (Properties tab). */
export function InspectorViewpointEditor({
  el,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'viewpoint' }>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 text-[11px]">
      <p className="text-[10px] text-muted">{t('inspector.viewpoint.hint')}</p>
      <label className={LABEL_CLS}>
        {t('inspector.fields.name')}
        <input
          className={INPUT_CLS}
          defaultValue={el.name}
          key={`vp-name-${el.id}-${el.name}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || v === el.name) return;
            onPersistProperty('name', v);
          }}
        />
      </label>
    </div>
  );
}

type CustomFamilyTypeElem = Extract<Element, { kind: 'family_type' }>;

function CustomTypeForm({
  discipline,
  onSave,
  onCancel,
}: {
  discipline: 'door' | 'window';
  onSave: (baseFamilyId: string, name: string, params: Record<string, unknown>) => void;
  onCancel: () => void;
}): JSX.Element {
  const families = BUILT_IN_FAMILIES.filter((f) => f.discipline === discipline);
  const [baseFamilyId, setBaseFamilyId] = useState(families[0]?.id ?? '');
  const [name, setName] = useState('');
  const [paramDraft, setParamDraft] = useState<Record<string, string>>({});

  const baseFam = getFamilyById(baseFamilyId);
  const lengthParams = baseFam?.params.filter((p) => p.type === 'length_mm') ?? [];

  function handleSave(): void {
    const params: Record<string, unknown> = { name: name.trim(), baseFamilyId };
    for (const p of lengthParams) {
      const raw = paramDraft[p.key];
      const val = raw !== undefined ? Number(raw) : (p.default as number);
      if (Number.isFinite(val)) params[p.key] = val;
    }
    onSave(baseFamilyId, name.trim(), params);
  }

  return (
    <div className="mt-1 space-y-1.5 rounded border border-border bg-background p-2">
      <label className={LABEL_CLS}>
        Base family
        <select
          className={INPUT_CLS}
          value={baseFamilyId}
          onChange={(e) => { setBaseFamilyId(e.target.value); setParamDraft({}); }}
        >
          {families.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </label>
      <label className={LABEL_CLS}>
        Type name
        <input
          className={INPUT_CLS}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Wide fire door"
          autoFocus
        />
      </label>
      {lengthParams.map((p) => (
        <label key={p.key} className={LABEL_CLS}>
          {p.label} (mm)
          <input
            className={INPUT_CLS}
            type="number"
            value={paramDraft[p.key] ?? String(p.default as number)}
            onChange={(e) => setParamDraft((d) => ({ ...d, [p.key]: e.target.value }))}
          />
        </label>
      ))}
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          disabled={!name.trim()}
          onClick={handleSave}
          className="flex-1 rounded border border-border bg-surface-strong px-2 py-0.5 text-[10px] hover:bg-accent-soft disabled:opacity-40"
        >
          Save type
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-border px-2 py-0.5 text-[10px] hover:bg-surface-strong"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Editable family type picker for door elements (Properties tab). */
export function InspectorDoorEditor({
  el,
  revision,
  elementsById = {},
  onPersistProperty,
  onCreateType,
}: {
  el: Extract<Element, { kind: 'door' }>;
  revision: number;
  elementsById?: Record<string, Element>;
  onPersistProperty: (key: string, value: string) => void;
  onCreateType?: (baseFamilyId: string, name: string, params: Record<string, unknown>) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const f = (key: string) => t(`inspector.fields.${key}`);
  const [showForm, setShowForm] = useState(false);
  const doorFamilies = BUILT_IN_FAMILIES.filter((fam) => fam.discipline === 'door');
  const customTypes = (Object.values(elementsById) as Element[]).filter(
    (e): e is CustomFamilyTypeElem => e.kind === 'family_type' && e.discipline === 'door',
  );

  // resolve display name: built-in types use catalog name; custom types use parameters.name
  function typeLabel(id: string): string {
    const builtin = getTypeById(id);
    if (builtin) return builtin.name;
    const custom = elementsById[id] as CustomFamilyTypeElem | undefined;
    return String(custom?.parameters.name ?? id);
  }
  void typeLabel; // used via select option text directly

  return (
    <div className="space-y-2 text-[11px]">
      <label className={LABEL_CLS}>
        {f('family')}
        <select
          className={INPUT_CLS}
          value={el.familyTypeId ?? ''}
          key={`door-ft-${el.id}-${el.familyTypeId ?? ''}-${revision}`}
          onChange={(e) => onPersistProperty('familyTypeId', e.target.value)}
        >
          <option value="">Generic</option>
          {doorFamilies.map((fam) => (
            <optgroup key={fam.id} label={fam.name}>
              {fam.defaultTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </optgroup>
          ))}
          {customTypes.length > 0 && (
            <optgroup label="Custom">
              {customTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>{String(ct.parameters.name ?? ct.id)}</option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {onCreateType && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-[10px] text-accent hover:underline"
        >
          + New custom type…
        </button>
      )}
      {onCreateType && showForm && (
        <CustomTypeForm
          discipline="door"
          onSave={(baseFamilyId, name, params) => {
            onCreateType(baseFamilyId, name, params);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
      <FieldRow label={f('wall')} value={el.wallId} mono />
      <FieldRow label={f('alongT')} value={el.alongT.toFixed(3)} mono />
    </div>
  );
}

/** Editable family type picker for window elements (Properties tab). */
export function InspectorWindowEditor({
  el,
  revision,
  elementsById = {},
  onPersistProperty,
  onCreateType,
}: {
  el: Extract<Element, { kind: 'window' }>;
  revision: number;
  elementsById?: Record<string, Element>;
  onPersistProperty: (key: string, value: string) => void;
  onCreateType?: (baseFamilyId: string, name: string, params: Record<string, unknown>) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const f = (key: string) => t(`inspector.fields.${key}`);
  const [showForm, setShowForm] = useState(false);
  const windowFamilies = BUILT_IN_FAMILIES.filter((fam) => fam.discipline === 'window');
  const customTypes = (Object.values(elementsById) as Element[]).filter(
    (e): e is CustomFamilyTypeElem => e.kind === 'family_type' && e.discipline === 'window',
  );

  return (
    <div className="space-y-2 text-[11px]">
      <label className={LABEL_CLS}>
        {f('family')}
        <select
          className={INPUT_CLS}
          value={el.familyTypeId ?? ''}
          key={`win-ft-${el.id}-${el.familyTypeId ?? ''}-${revision}`}
          onChange={(e) => onPersistProperty('familyTypeId', e.target.value)}
        >
          <option value="">Generic</option>
          {windowFamilies.map((fam) => (
            <optgroup key={fam.id} label={fam.name}>
              {fam.defaultTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </optgroup>
          ))}
          {customTypes.length > 0 && (
            <optgroup label="Custom">
              {customTypes.map((ct) => (
                <option key={ct.id} value={ct.id}>{String(ct.parameters.name ?? ct.id)}</option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      {onCreateType && !showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="text-[10px] text-accent hover:underline"
        >
          + New custom type…
        </button>
      )}
      {onCreateType && showForm && (
        <CustomTypeForm
          discipline="window"
          onSave={(baseFamilyId, name, params) => {
            onCreateType(baseFamilyId, name, params);
            setShowForm(false);
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
      <FieldRow label={f('width')} value={fmtMm(el.widthMm)} />
      <FieldRow label={f('height')} value={fmtMm(el.heightMm)} />
      <FieldRow label={f('sillHeight')} value={fmtMm(el.sillHeightMm)} />
      <FieldRow label={f('wall')} value={el.wallId} mono />
    </div>
  );
}

/** Editable name field for view_template elements (Properties tab). */
export function InspectorViewTemplateEditor({
  el,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'view_template' }>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 text-[11px]">
      <p className="text-[10px] font-semibold text-muted">{t('inspector.viewTemplate.heading')}</p>
      <label className={LABEL_CLS}>
        {t('inspector.fields.name')}
        <input
          className={INPUT_CLS}
          defaultValue={el.name}
          key={`vt-name-${el.id}-${el.name}-${revision}`}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v || v === el.name) return;
            onPersistProperty('name', v);
          }}
        />
      </label>
      <FieldRow label={t('inspector.fields.scale')} value={el.scale} mono />
    </div>
  );
}
