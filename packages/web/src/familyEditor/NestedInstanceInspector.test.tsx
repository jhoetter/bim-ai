import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';

import i18n from '../i18n';
import { NestedInstanceInspector, type HostParamRef } from './NestedInstanceInspector';
import type { FamilyDefinition, FamilyInstanceRefNode } from '../families/types';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => {
  cleanup();
});

const NESTED_FAMILY: FamilyDefinition = {
  id: 'builtin:swing-arc',
  name: 'Swing Arc',
  discipline: 'door',
  params: [
    {
      key: 'Radius',
      label: 'Radius',
      type: 'length_mm',
      default: 600,
      instanceOverridable: true,
    },
    {
      key: 'Frame Width',
      label: 'Frame Width',
      type: 'length_mm',
      default: 50,
      instanceOverridable: true,
    },
  ],
  defaultTypes: [],
};

const HOST_PARAMS: HostParamRef[] = [
  { key: 'Rough Width', label: 'Rough Width', type: 'length_mm' },
  { key: 'Frame Width', label: 'Frame Width', type: 'length_mm' },
  { key: 'Show Swing', label: 'Show Swing', type: 'boolean' },
];

const BASE_INSTANCE: FamilyInstanceRefNode = {
  kind: 'family_instance_ref',
  familyId: NESTED_FAMILY.id,
  positionMm: { xMm: 0, yMm: 0, zMm: 0 },
  rotationDeg: 0,
  parameterBindings: {},
};

describe('FAM-01 — <NestedInstanceInspector />', () => {
  it('changing position fields fires onUpdate with merged positionMm', () => {
    const onUpdate = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <NestedInstanceInspector
        instance={BASE_INSTANCE}
        nestedFamily={NESTED_FAMILY}
        hostParams={HOST_PARAMS}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(getByLabelText('nested-instance-xMm'), { target: { value: '250' } });
    expect(onUpdate).toHaveBeenCalledWith({
      positionMm: { xMm: 250, yMm: 0, zMm: 0 },
    });
  });

  it('changing rotation fires onUpdate with rotationDeg', () => {
    const onUpdate = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <NestedInstanceInspector
        instance={BASE_INSTANCE}
        nestedFamily={NESTED_FAMILY}
        hostParams={HOST_PARAMS}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(getByLabelText('nested-instance-rotation'), { target: { value: '90' } });
    expect(onUpdate).toHaveBeenCalledWith({ rotationDeg: 90 });
  });

  it('switching binding kind from literal → host_param picks the first numeric host param', () => {
    const onUpdate = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <NestedInstanceInspector
        instance={BASE_INSTANCE}
        nestedFamily={NESTED_FAMILY}
        hostParams={HOST_PARAMS}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(getByLabelText('binding-kind-Radius'), { target: { value: 'host_param' } });
    expect(onUpdate).toHaveBeenCalledWith({
      parameterBindings: {
        Radius: { kind: 'host_param', paramName: 'Rough Width' },
      },
    });
  });

  it('formula binding fires update with the typed expression', () => {
    const instanceWithFormula: FamilyInstanceRefNode = {
      ...BASE_INSTANCE,
      parameterBindings: {
        Radius: { kind: 'formula', expression: '' },
      },
    };
    const onUpdate = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <NestedInstanceInspector
        instance={instanceWithFormula}
        nestedFamily={NESTED_FAMILY}
        hostParams={HOST_PARAMS}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(getByLabelText('binding-formula-Radius'), {
      target: { value: 'Rough Width - 2 * Frame Width' },
    });
    expect(onUpdate).toHaveBeenCalledWith({
      parameterBindings: {
        Radius: { kind: 'formula', expression: 'Rough Width - 2 * Frame Width' },
      },
    });
  });

  it('literal binding fires update with the numeric value', () => {
    const onUpdate = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <NestedInstanceInspector
        instance={{
          ...BASE_INSTANCE,
          parameterBindings: { Radius: { kind: 'literal', value: 0 } },
        }}
        nestedFamily={NESTED_FAMILY}
        hostParams={HOST_PARAMS}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(getByLabelText('binding-value-Radius'), { target: { value: '750' } });
    expect(onUpdate).toHaveBeenCalledWith({
      parameterBindings: { Radius: { kind: 'literal', value: 750 } },
    });
  });

  it('renders a placeholder for visibility binding when no boolean host params exist', () => {
    const numericOnly = HOST_PARAMS.filter((p) => p.type !== 'boolean');
    const { getByTestId } = renderWithI18n(
      <NestedInstanceInspector
        instance={BASE_INSTANCE}
        nestedFamily={NESTED_FAMILY}
        hostParams={numericOnly}
        onUpdate={vi.fn()}
      />,
    );
    expect(getByTestId('nested-instance-visibility-placeholder')).toBeTruthy();
  });

  it('selecting a boolean host param sets the visibility binding', () => {
    const onUpdate = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <NestedInstanceInspector
        instance={BASE_INSTANCE}
        nestedFamily={NESTED_FAMILY}
        hostParams={HOST_PARAMS}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.change(getByLabelText('Visible When'), { target: { value: 'Show Swing' } });
    expect(onUpdate).toHaveBeenCalledWith({
      visibilityBinding: { paramName: 'Show Swing', whenTrue: true },
    });
  });
});
