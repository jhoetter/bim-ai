import type { JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { Element, ViewTemplateControlledField } from '@bim-ai/core';

const INPUT_CLS =
  'mt-1 w-full rounded border border-border bg-background px-2 py-1 font-mono text-[11px]';
const LABEL_CLS = 'block text-[10px] text-muted';
const VIEW_TEMPLATE_CONTROL_FIELDS: Array<{
  field: ViewTemplateControlledField;
  label: string;
}> = [
  { field: 'scale', label: 'Scale' },
  { field: 'detailLevel', label: 'Detail level' },
  { field: 'phase', label: 'Phase' },
  { field: 'phaseFilter', label: 'Phase filter' },
  { field: 'elementOverrides', label: 'Element overrides' },
];

function viewTemplateControlState(
  el: Extract<Element, { kind: 'view_template' }>,
  field: ViewTemplateControlledField,
): { included: boolean; locked: boolean } {
  const control = el.templateControlMatrix?.[field];
  const included = control?.included ?? true;
  return { included, locked: control?.locked ?? included };
}

function viewTemplateControlPatch(
  field: ViewTemplateControlledField,
  included: boolean,
  locked: boolean,
): string {
  return JSON.stringify({
    templateControlMatrix: {
      [field]: { included, locked: included ? locked : false },
    },
  });
}

/** Editable inspector for view_template elements (Properties tab). */
export function InspectorViewTemplateEditor({
  el,
  elementsById,
  revision,
  onPersistProperty,
}: {
  el: Extract<Element, { kind: 'view_template' }>;
  elementsById?: Record<string, Element>;
  revision: number;
  onPersistProperty: (key: string, value: string) => void;
}): JSX.Element {
  const { t } = useTranslation();

  const phases = elementsById
    ? (Object.values(elementsById) as Element[]).filter(
        (e): e is Extract<Element, { kind: 'phase' }> => e.kind === 'phase',
      )
    : [];

  return (
    <div className="space-y-2 text-[11px]">
      <p className="text-[10px] font-semibold text-muted">{t('inspector.viewTemplate.heading')}</p>

      <div className="rounded border border-border">
        <div className="grid grid-cols-[1fr_54px_44px] gap-1 border-b border-border px-2 py-1 text-[9px] font-semibold uppercase text-muted">
          <span>Property</span>
          <span>Include</span>
          <span>Lock</span>
        </div>
        {VIEW_TEMPLATE_CONTROL_FIELDS.map(({ field, label }) => {
          const control = viewTemplateControlState(el, field);
          return (
            <div
              key={field}
              className="grid grid-cols-[1fr_54px_44px] items-center gap-1 px-2 py-1 text-[10px]"
            >
              <span className="truncate text-muted">{label}</span>
              <input
                type="checkbox"
                data-testid={`inspector-vt-control-${field}-include`}
                aria-label={`${label} include`}
                checked={control.included}
                onChange={(e) => {
                  const included = e.target.checked;
                  onPersistProperty(
                    '__updateViewTemplate__',
                    viewTemplateControlPatch(field, included, included ? control.locked : false),
                  );
                }}
              />
              <input
                type="checkbox"
                data-testid={`inspector-vt-control-${field}-lock`}
                aria-label={`${label} lock`}
                checked={control.locked}
                disabled={!control.included}
                onChange={(e) => {
                  onPersistProperty(
                    '__updateViewTemplate__',
                    viewTemplateControlPatch(field, control.included, e.target.checked),
                  );
                }}
              />
            </div>
          );
        })}
      </div>

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

      <label className={LABEL_CLS}>
        {t('inspector.fields.scale')}
        <input
          type="number"
          className={INPUT_CLS}
          defaultValue={el.scale != null ? String(el.scale) : ''}
          key={`vt-scale-${el.id}-${el.scale ?? 'null'}-${revision}`}
          placeholder="inherit"
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const n = raw === '' ? null : Number(raw);
            if (n !== null && !Number.isFinite(n)) return;
            onPersistProperty('__updateViewTemplate__', JSON.stringify({ scale: n }));
          }}
        />
      </label>

      <label className={LABEL_CLS}>
        {t('inspector.fields.detailLevel', 'Detail level')}
        <select
          className={INPUT_CLS}
          value={el.detailLevel ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onPersistProperty('__updateViewTemplate__', JSON.stringify({ detailLevel: v || null }));
          }}
        >
          <option value="">-- inherit --</option>
          <option value="coarse">Coarse</option>
          <option value="medium">Medium</option>
          <option value="fine">Fine</option>
        </select>
      </label>

      {phases.length > 0 ? (
        <label className={LABEL_CLS}>
          {t('inspector.fields.phase', 'Phase')}
          <select
            className={INPUT_CLS}
            value={el.phase ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onPersistProperty('__updateViewTemplate__', JSON.stringify({ phase: v || null }));
            }}
          >
            <option value="">-- none --</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className={LABEL_CLS}>
        {t('inspector.fields.phaseFilter', 'Phase filter')}
        <select
          className={INPUT_CLS}
          value={el.phaseFilter ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onPersistProperty('__updateViewTemplate__', JSON.stringify({ phaseFilter: v || null }));
          }}
        >
          <option value="">-- none --</option>
          <option value="all">All</option>
          <option value="existing">Existing</option>
          <option value="demolition">Demolition</option>
          <option value="new">New</option>
        </select>
      </label>
    </div>
  );
}
