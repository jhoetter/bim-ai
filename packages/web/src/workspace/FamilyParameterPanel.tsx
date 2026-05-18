import React, { useState } from 'react';
import type { Element } from '@bim-ai/core';

type FamilyParam = Extract<Element, { kind: 'family_parameter' }>;

interface Props {
  parameters: FamilyParam[];
  onAdd: (param: Omit<FamilyParam, 'id'>) => void;
  onDelete: (id: string) => void;
  onValueChange: (id: string, value: number | boolean | string) => void;
  /** §15.1.2: optional callback to update a parameter field (e.g. formula) by name. */
  onUpdateParam?: (name: string, patch: Record<string, unknown>) => void;
}

export function FamilyParameterPanel({
  parameters,
  onAdd,
  onDelete,
  onValueChange,
  onUpdateParam,
}: Props) {
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FamilyParam['paramType']>('length');

  return (
    <div data-testid="family-parameter-panel">
      <h4>Parameters</h4>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Value</th>
            <th>Formula</th>
            <th>Instance</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((p) => (
            <tr key={p.id} data-testid={`family-param-row-${p.id}`}>
              <td data-testid={`family-param-name-${p.id}`}>{p.name}</td>
              <td data-testid={`family-param-type-${p.id}`}>{p.paramType}</td>
              <td>
                <input
                  data-testid={`family-param-value-${p.id}`}
                  type={p.paramType === 'boolean' ? 'checkbox' : 'number'}
                  value={p.paramType !== 'boolean' ? (p.defaultValue as number) : undefined}
                  checked={p.paramType === 'boolean' ? (p.defaultValue as boolean) : undefined}
                  onChange={(e) =>
                    onValueChange(
                      p.id,
                      p.paramType === 'boolean' ? e.target.checked : +e.target.value,
                    )
                  }
                />
              </td>
              <td>
                <input
                  data-testid={`family-param-formula-${p.name}`}
                  type="text"
                  placeholder="= formula (e.g. Width / 2)"
                  value={(p as any).formula ?? ''}
                  onChange={(e) =>
                    onUpdateParam?.(p.name, { formula: e.target.value || undefined })
                  }
                  style={{
                    fontSize: 10,
                    padding: '1px 4px',
                    border: '1px solid var(--border, #555)',
                    borderRadius: 2,
                    background: 'transparent',
                    color: '#a78bfa',
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  data-testid={`family-param-instance-${p.id}`}
                  checked={p.isInstance}
                  readOnly
                />
              </td>
              <td>
                <button data-testid={`family-param-delete-${p.id}`} onClick={() => onDelete(p.id)}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Add new parameter */}
      <div data-testid="family-param-add-row" style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input
          data-testid="family-param-new-name"
          placeholder="Parameter name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <select
          data-testid="family-param-new-type"
          value={newType}
          onChange={(e) => setNewType(e.target.value as FamilyParam['paramType'])}
        >
          <option value="length">Length (mm)</option>
          <option value="angle">Angle (°)</option>
          <option value="number">Number</option>
          <option value="boolean">Boolean</option>
        </select>
        <button
          data-testid="family-param-add-btn"
          disabled={!newName.trim()}
          onClick={() => {
            onAdd({
              kind: 'family_parameter',
              name: newName.trim(),
              paramType: newType,
              defaultValue: newType === 'length' ? 1000 : newType === 'boolean' ? false : 0,
              isInstance: true,
              familyId: null,
            });
            setNewName('');
          }}
        >
          Add
        </button>
      </div>
    </div>
  );
}
