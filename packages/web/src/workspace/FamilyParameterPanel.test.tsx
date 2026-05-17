import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { Element } from '@bim-ai/core';

import { FamilyParameterPanel } from './FamilyParameterPanel';

type FamilyParam = Extract<Element, { kind: 'family_parameter' }>;

function makeParam(overrides: Partial<FamilyParam> & { id: string; name: string }): FamilyParam {
  return {
    kind: 'family_parameter',
    paramType: 'length',
    defaultValue: 1000,
    isInstance: true,
    familyId: null,
    ...overrides,
  };
}

describe('FamilyParameterPanel — §15.1.3', () => {
  afterEach(cleanup);
  it('renders family-parameter-panel', () => {
    render(
      <FamilyParameterPanel
        parameters={[]}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('family-parameter-panel')).toBeTruthy();
  });

  it('renders one row per parameter', () => {
    const params = [
      makeParam({ id: 'p1', name: 'Width' }),
      makeParam({ id: 'p2', name: 'Height' }),
    ];
    render(
      <FamilyParameterPanel
        parameters={params}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('family-param-row-p1')).toBeTruthy();
    expect(screen.getByTestId('family-param-row-p2')).toBeTruthy();
    expect(screen.getByTestId('family-param-name-p1').textContent).toBe('Width');
    expect(screen.getByTestId('family-param-name-p2').textContent).toBe('Height');
  });

  it('Add button is disabled when name is empty', () => {
    render(
      <FamilyParameterPanel
        parameters={[]}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );
    const btn = screen.getByTestId('family-param-add-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('entering a name and clicking Add calls onAdd', () => {
    const onAdd = vi.fn();
    render(
      <FamilyParameterPanel
        parameters={[]}
        onAdd={onAdd}
        onDelete={vi.fn()}
        onValueChange={vi.fn()}
      />,
    );
    const nameInput = screen.getByTestId('family-param-new-name');
    fireEvent.change(nameInput, { target: { value: 'MyParam' } });
    const btn = screen.getByTestId('family-param-add-btn');
    fireEvent.click(btn);
    expect(onAdd).toHaveBeenCalledOnce();
    expect(onAdd.mock.calls[0][0]).toMatchObject({ name: 'MyParam', kind: 'family_parameter' });
  });

  it('clicking delete calls onDelete with correct id', () => {
    const onDelete = vi.fn();
    const params = [makeParam({ id: 'p1', name: 'Width' })];
    render(
      <FamilyParameterPanel
        parameters={params}
        onAdd={vi.fn()}
        onDelete={onDelete}
        onValueChange={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('family-param-delete-p1'));
    expect(onDelete).toHaveBeenCalledWith('p1');
  });
});
