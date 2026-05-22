import type { JSX } from 'react';
import type { TFunction } from 'i18next';

import { MaterialDefaultEditor } from './FamilyEditorWorkbenchPanels';
import type { Param, MaterialAssignmentTarget } from './familyEditorWorkbenchDefaults';

type AppearanceAssignmentTarget = MaterialAssignmentTarget;

export interface FamilyEditorParametersSectionProps {
  t: TFunction;
  params: Param[];
  validateFormula: (formula: string, otherParams: string[]) => string | null;
  updateParam: (index: number, patch: Partial<Param>) => void;
  addParam: () => void;
  setMaterialTarget: (target: MaterialAssignmentTarget) => void;
  setAppearanceTarget: (target: AppearanceAssignmentTarget) => void;
}

/**
 * Family editor parameters table — extracted out of the main workbench
 * shell. Renders the Key / Label / Type / Default / Scope / Formula
 * editor rows and the "+ Add parameter" button.
 */
export function FamilyEditorParametersSection({
  t,
  params,
  validateFormula,
  updateParam,
  addParam,
  setMaterialTarget,
  setAppearanceTarget,
}: FamilyEditorParametersSectionProps): JSX.Element {
  return (
    <section>
      <h2 className="font-semibold mb-2">{t('familyEditor.parametersHeading')}</h2>
      <table className="w-full mb-2">
        <thead>
          <tr>
            <th>Key</th>
            <th>Label</th>
            <th>Type</th>
            <th>Default</th>
            <th>Scope</th>
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
                    onChange={(e) => updateParam(i, { type: e.target.value as Param['type'] })}
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
                  {param.type === 'boolean' && (
                    <input
                      type="checkbox"
                      aria-label={`parameter-default-${param.key}`}
                      checked={Boolean(param.default)}
                      onChange={(e) => updateParam(i, { default: e.target.checked })}
                    />
                  )}
                  {param.type === 'option' && (
                    <input
                      value={String(param.default ?? '')}
                      onChange={(e) => updateParam(i, { default: e.target.value })}
                    />
                  )}
                </td>
                <td>
                  <select
                    aria-label={`parameter-scope-${param.key}`}
                    value={param.instanceOverridable ? 'instance' : 'type'}
                    onChange={(e) =>
                      updateParam(i, { instanceOverridable: e.target.value === 'instance' })
                    }
                  >
                    <option value="type">Type</option>
                    <option value="instance">Instance</option>
                  </select>
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
  );
}
