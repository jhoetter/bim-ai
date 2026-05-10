/**
 * FAM-01 — per-instance parameter editor.
 *
 * Inspector panel for a selected nested-family instance. Lets the
 * author edit position / rotation and bind every parameter the nested
 * family exposes to a literal, host param, or formula (FAM-04
 * evaluator). Visibility binding (FAM-03) is wired separately and
 * shown here as a placeholder until the host family's boolean params
 * are surfaced; FAM-03 already shipped, so the dropdown enumerates the
 * host's boolean params when any are present.
 */
import { type JSX } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  FamilyDefinition,
  FamilyInstanceRefNode,
  FamilyVisibilityViewType,
  ParameterBinding,
  VisibilityBinding,
  VisibilityByDetailLevel,
  VisibilityByViewType,
} from '../families/types';
import { validateFormula } from '../lib/expressionEvaluator';

export interface HostParamRef {
  key: string;
  label: string;
  type: 'length_mm' | 'angle_deg' | 'material_key' | 'boolean' | 'option';
}

export interface NestedInstanceInspectorProps {
  instance: FamilyInstanceRefNode;
  /** The nested family's definition (so we know which params to bind). */
  nestedFamily: FamilyDefinition | undefined;
  /** Host-family param list (so dropdowns can target them). */
  hostParams: HostParamRef[];
  onUpdate: (patch: Partial<FamilyInstanceRefNode>) => void;
}

const VISIBLE_ALWAYS = '__always__';
const DETAIL_LEVELS: { key: keyof VisibilityByDetailLevel; label: string }[] = [
  { key: 'coarse', label: 'Coarse' },
  { key: 'medium', label: 'Medium' },
  { key: 'fine', label: 'Fine' },
];
const VIEW_TYPES: { key: FamilyVisibilityViewType; label: string }[] = [
  { key: 'plan_rcp', label: 'Plan/RCP' },
  { key: 'front_back', label: 'Front/Back' },
  { key: 'left_right', label: 'Left/Right' },
  { key: 'three_d', label: '3D Views' },
  { key: 'elevation', label: 'Elevations' },
  { key: 'section', label: 'Sections' },
];

export function NestedInstanceInspector({
  instance,
  nestedFamily,
  hostParams,
  onUpdate,
}: NestedInstanceInspectorProps): JSX.Element {
  const { t } = useTranslation();
  const numericHostParams = hostParams.filter(
    (p) => p.type === 'length_mm' || p.type === 'angle_deg',
  );
  const booleanHostParams = hostParams.filter((p) => p.type === 'boolean');

  function setPosition(axis: 'xMm' | 'yMm' | 'zMm', value: number) {
    onUpdate({ positionMm: { ...instance.positionMm, [axis]: value } });
  }

  function setRotation(deg: number) {
    onUpdate({ rotationDeg: deg });
  }

  function setBinding(paramName: string, binding: ParameterBinding | null) {
    const next = { ...instance.parameterBindings };
    if (binding === null) delete next[paramName];
    else next[paramName] = binding;
    onUpdate({ parameterBindings: next });
  }

  function setVisibility(binding: VisibilityBinding | undefined) {
    onUpdate({ visibilityBinding: binding });
  }

  function setDetailLevelVisibility(level: keyof VisibilityByDetailLevel, visible: boolean) {
    const next: VisibilityByDetailLevel = { ...(instance.visibilityByDetailLevel ?? {}) };
    next[level] = visible;
    onUpdate({ visibilityByDetailLevel: next });
  }

  function setViewTypeVisibility(viewType: FamilyVisibilityViewType, visible: boolean) {
    const next: VisibilityByViewType = { ...(instance.visibilityByViewType ?? {}) };
    next[viewType] = visible;
    onUpdate({ visibilityByViewType: next });
  }

  return (
    <section
      className="border rounded p-3 space-y-3"
      role="region"
      aria-label={t('familyEditor.nestedInstanceInspectorAriaLabel')}
    >
      <header className="flex items-center gap-2">
        <h3 className="font-semibold text-sm">
          {t('familyEditor.nestedInstanceHeading', {
            name: nestedFamily?.name ?? instance.familyId,
          })}
        </h3>
      </header>

      <fieldset className="text-sm space-y-1">
        <legend className="font-medium">{t('familyEditor.nestedInstancePosition')}</legend>
        <div className="flex gap-2 items-center">
          {(['xMm', 'yMm', 'zMm'] as const).map((axis) => (
            <label key={axis} className="flex items-center gap-1">
              <span className="w-6 text-xs uppercase">{axis.replace('Mm', '')}</span>
              <input
                type="number"
                aria-label={`nested-instance-${axis}`}
                value={instance.positionMm[axis]}
                onChange={(e) => setPosition(axis, Number(e.target.value))}
                className="w-20"
              />
            </label>
          ))}
        </div>
      </fieldset>

      <label className="text-sm flex items-center gap-2">
        <span className="w-32 font-medium">{t('familyEditor.nestedInstanceRotation')}</span>
        <input
          type="number"
          aria-label="nested-instance-rotation"
          value={instance.rotationDeg}
          onChange={(e) => setRotation(Number(e.target.value))}
          className="w-24"
        />
        <span className="text-xs text-muted">°</span>
      </label>

      <section>
        <h4 className="font-medium text-sm mb-1">
          {t('familyEditor.nestedInstanceBindingsHeading')}
        </h4>
        {!nestedFamily || nestedFamily.params.length === 0 ? (
          <p className="text-xs text-muted">{t('familyEditor.nestedInstanceNoParams')}</p>
        ) : (
          <ul className="space-y-1">
            {nestedFamily.params.map((p) => (
              <BindingRow
                key={p.key}
                paramKey={p.key}
                paramLabel={p.label || p.key}
                binding={instance.parameterBindings[p.key]}
                hostParams={numericHostParams}
                onChange={(b) => setBinding(p.key, b)}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h4 className="font-medium text-sm mb-1">
          {t('familyEditor.nestedInstanceVisibilityHeading')}
        </h4>
        {booleanHostParams.length === 0 ? (
          <p className="text-xs text-muted" data-testid="nested-instance-visibility-placeholder">
            {t('familyEditor.nestedInstanceVisibilityPlaceholder')}
          </p>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <span className="w-32">{t('familyEditor.visibleWhenLabel')}</span>
            <select
              aria-label={t('familyEditor.visibleWhenLabel')}
              value={instance.visibilityBinding?.paramName ?? VISIBLE_ALWAYS}
              onChange={(e) => {
                const v = e.target.value;
                if (v === VISIBLE_ALWAYS) setVisibility(undefined);
                else setVisibility({ paramName: v, whenTrue: true });
              }}
            >
              <option value={VISIBLE_ALWAYS}>{t('familyEditor.visibleAlways')}</option>
              {booleanHostParams.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label || p.key}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="mt-2" role="group" aria-label="Nested visibility by detail level">
          <div className="text-xs font-medium">Detail levels</div>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {DETAIL_LEVELS.map((option) => (
              <label key={option.key} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  aria-label={`nested-visibility-${option.key}`}
                  checked={instance.visibilityByDetailLevel?.[option.key] !== false}
                  onChange={(e) => setDetailLevelVisibility(option.key, e.target.checked)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
        <div className="mt-2" role="group" aria-label="Nested visibility by view type">
          <div className="text-xs font-medium">View types</div>
          <div className="mt-1 flex flex-wrap gap-3 text-sm">
            {VIEW_TYPES.map((option) => (
              <label key={option.key} className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  aria-label={`nested-visibility-view-${option.key}`}
                  checked={instance.visibilityByViewType?.[option.key] !== false}
                  onChange={(e) => setViewTypeVisibility(option.key, e.target.checked)}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

interface BindingRowProps {
  paramKey: string;
  paramLabel: string;
  binding: ParameterBinding | undefined;
  hostParams: HostParamRef[];
  onChange: (binding: ParameterBinding | null) => void;
}

function BindingRow({
  paramKey,
  paramLabel,
  binding,
  hostParams,
  onChange,
}: BindingRowProps): JSX.Element {
  const { t } = useTranslation();
  const kind = binding?.kind ?? 'literal';

  function setKind(nextKind: ParameterBinding['kind']) {
    if (nextKind === 'literal') {
      onChange({ kind: 'literal', value: 0 });
    } else if (nextKind === 'host_param') {
      onChange({ kind: 'host_param', paramName: hostParams[0]?.key ?? '' });
    } else {
      onChange({ kind: 'formula', expression: '' });
    }
  }

  function setLiteral(raw: string) {
    const numeric = Number(raw);
    const value: number | string = Number.isFinite(numeric) ? numeric : raw;
    onChange({ kind: 'literal', value });
  }

  const formulaError =
    binding?.kind === 'formula'
      ? validateFormula(
          binding.expression,
          hostParams.map((p) => p.key),
        )
      : null;

  return (
    <li className="flex items-center gap-2 text-sm" data-testid={`binding-row-${paramKey}`}>
      <span className="w-32 truncate">{paramLabel}</span>
      <select
        aria-label={`binding-kind-${paramKey}`}
        value={kind}
        onChange={(e) => setKind(e.target.value as ParameterBinding['kind'])}
      >
        <option value="literal">{t('familyEditor.bindingKindLiteral')}</option>
        <option value="host_param">{t('familyEditor.bindingKindHostParam')}</option>
        <option value="formula">{t('familyEditor.bindingKindFormula')}</option>
      </select>
      {kind === 'literal' && (
        <input
          type="number"
          aria-label={`binding-value-${paramKey}`}
          value={
            binding?.kind === 'literal' && typeof binding.value === 'number'
              ? binding.value
              : binding?.kind === 'literal'
                ? String(binding.value)
                : 0
          }
          onChange={(e) => setLiteral(e.target.value)}
        />
      )}
      {kind === 'host_param' && (
        <select
          aria-label={`binding-host-param-${paramKey}`}
          value={binding?.kind === 'host_param' ? binding.paramName : ''}
          onChange={(e) => onChange({ kind: 'host_param', paramName: e.target.value })}
        >
          {hostParams.length === 0 && (
            <option value="">{t('familyEditor.bindingNoHostParams')}</option>
          )}
          {hostParams.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label || p.key}
            </option>
          ))}
        </select>
      )}
      {kind === 'formula' && (
        <>
          <input
            type="text"
            aria-label={`binding-formula-${paramKey}`}
            aria-invalid={formulaError !== null}
            value={binding?.kind === 'formula' ? binding.expression : ''}
            onChange={(e) => onChange({ kind: 'formula', expression: e.target.value })}
            className="flex-1"
          />
          {formulaError && (
            <span
              role="alert"
              className="text-xs text-danger"
              data-testid={`binding-formula-error-${paramKey}`}
            >
              {formulaError}
            </span>
          )}
        </>
      )}
    </li>
  );
}
