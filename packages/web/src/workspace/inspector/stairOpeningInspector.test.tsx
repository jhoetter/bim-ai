import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const stair: Extract<Element, { kind: 'stair' }> = {
  kind: 'stair',
  id: 'stair-1',
  name: 'Test Stair',
  baseLevelId: 'lvl-ground',
  topLevelId: 'lvl-upper',
  runStartMm: { xMm: 0, yMm: 0 },
  runEndMm: { xMm: 4000, yMm: 0 },
  widthMm: 1200,
  riserMm: 175,
  treadMm: 260,
};

describe('stair floor opening inspector — §2.5.3', () => {
  it('renders inspector-stair-create-opening button', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stair, t));
    expect(getByTestId('inspector-stair-create-opening')).toBeTruthy();
  });

  it('clicking button dispatches create_shaft with correct boundary', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(stair, t, { onDispatchCommand }));
    fireEvent.click(getByTestId('inspector-stair-create-opening'));
    expect(onDispatchCommand).toHaveBeenCalledOnce();
    const cmd = onDispatchCommand.mock.calls[0]![0] as Record<string, unknown>;
    expect(cmd.type).toBe('create_shaft');
    expect(Array.isArray(cmd.boundaryMm)).toBe(true);
    expect((cmd.boundaryMm as unknown[]).length).toBe(4);
  });

  it('shaft baseLevelId matches stair baseLevelId', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(stair, t, { onDispatchCommand }));
    fireEvent.click(getByTestId('inspector-stair-create-opening'));
    const cmd = onDispatchCommand.mock.calls[0]![0] as Record<string, unknown>;
    expect(cmd.baseLevelId).toBe('lvl-ground');
    expect(cmd.topLevelId).toBe('lvl-upper');
  });
});
