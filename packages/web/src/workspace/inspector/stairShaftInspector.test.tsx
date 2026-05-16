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

describe('stair shaft inspector — §2.5.3', () => {
  it('renders inspector-stair-create-shaft button when linkedShaftId is null', () => {
    const { getByTestId } = render(InspectorPropertiesFor({ ...stair, linkedShaftId: null }, t));
    expect(getByTestId('inspector-stair-create-shaft')).toBeTruthy();
  });

  it('renders inspector-stair-create-shaft button when linkedShaftId is undefined', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stair, t));
    expect(getByTestId('inspector-stair-create-shaft')).toBeTruthy();
  });

  it('does not render create-shaft button when linkedShaftId is set', () => {
    const { queryByTestId } = render(
      InspectorPropertiesFor({ ...stair, linkedShaftId: 'shaft-abc-123' }, t),
    );
    expect(queryByTestId('inspector-stair-create-shaft')).toBeNull();
  });

  it('shows auto-created shaft text when linkedShaftId is set', () => {
    const { getByText } = render(
      InspectorPropertiesFor({ ...stair, linkedShaftId: 'shaft-abc-123' }, t),
    );
    expect(getByText('Auto-created shaft')).toBeTruthy();
  });

  it('create-shaft button dispatches inspector_create_shaft_for_stair', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(stair, t, { onDispatchCommand }));
    fireEvent.click(getByTestId('inspector-stair-create-shaft'));
    expect(onDispatchCommand).toHaveBeenCalledOnce();
    const cmd = onDispatchCommand.mock.calls[0]![0] as Record<string, unknown>;
    expect(cmd.type).toBe('inspector_create_shaft_for_stair');
    expect(cmd.stairId).toBe('stair-1');
  });
});
