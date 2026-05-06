import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import type { FamilyParamDef } from '../families/types';

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

export function FamilyEditorWorkbench(): JSX.Element {
  const { t } = useTranslation();
  const [template, setTemplate] = useState<Template>('generic_model');
  const [refPlanes, setRefPlanes] = useState<RefPlane[]>([]);
  const [params, setParams] = useState<Param[]>([]);

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
      </div>

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
            {params.map((param, i) => (
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
                    onChange={(e) => updateParam(i, { formula: e.target.value })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addParam}>{t('familyEditor.addParameter')}</button>
      </section>

      <button
        onClick={() => console.warn('load-into-project stub', { template, refPlanes, params })}
      >
        {t('familyEditor.loadIntoProject')}
      </button>
    </div>
  );
}
