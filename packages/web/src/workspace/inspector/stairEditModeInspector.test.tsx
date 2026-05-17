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
  id: 'stair-edit-1',
  name: 'Edit Mode Stair',
  baseLevelId: 'lvl-ground',
  topLevelId: 'lvl-upper',
  runStartMm: { xMm: 0, yMm: 0 },
  runEndMm: { xMm: 4000, yMm: 0 },
  widthMm: 1200,
  riserMm: 175,
  treadMm: 260,
  riserCount: 10,
  runWidthMm: 1200,
};

const stairInEditMode = {
  ...stair,
  editStairActive: true,
} as Extract<Element, { kind: 'stair' }>;

describe('stair edit mode inspector — §8.6.4', () => {
  it('renders Edit Stair button when not in edit mode', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stair, t));
    expect(getByTestId('inspector-stair-edit-btn')).toBeTruthy();
  });

  it('shows Edit Mode label when editStairActive is true', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stairInEditMode, t));
    expect(getByTestId('inspector-stair-edit-mode-active')).toBeTruthy();
  });

  it('shows run editor with riser count input when in edit mode', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stairInEditMode, t));
    expect(getByTestId('inspector-stair-run-risers-0')).toBeTruthy();
  });

  it('shows Finish Editing button when in edit mode', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stairInEditMode, t));
    expect(getByTestId('inspector-stair-finish-edit-btn')).toBeTruthy();
  });

  it('does not show Finish Editing button when not in edit mode', () => {
    const { queryByTestId } = render(InspectorPropertiesFor(stair, t));
    expect(queryByTestId('inspector-stair-finish-edit-btn')).toBeNull();
  });

  it('Edit Stair button dispatches enterStairEditMode command', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(InspectorPropertiesFor(stair, t, { onDispatchCommand }));
    fireEvent.click(getByTestId('inspector-stair-edit-btn'));
    expect(onDispatchCommand).toHaveBeenCalledOnce();
    const cmd = onDispatchCommand.mock.calls[0]![0] as Record<string, unknown>;
    expect(cmd.type).toBe('enterStairEditMode');
    expect(cmd.stairId).toBe('stair-edit-1');
  });

  it('Finish Editing button dispatches exitStairEditMode command', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(stairInEditMode, t, { onDispatchCommand }),
    );
    fireEvent.click(getByTestId('inspector-stair-finish-edit-btn'));
    expect(onDispatchCommand).toHaveBeenCalledOnce();
    const cmd = onDispatchCommand.mock.calls[0]![0] as Record<string, unknown>;
    expect(cmd.type).toBe('exitStairEditMode');
    expect(cmd.stairId).toBe('stair-edit-1');
  });

  it('shows run row for each run in runs array', () => {
    const stairWithRuns = {
      ...stairInEditMode,
      runs: [
        { runIndex: 0, riserCount: 8, runWidthMm: 1100 },
        { runIndex: 1, riserCount: 9, runWidthMm: 1200 },
      ],
    } as Extract<Element, { kind: 'stair' }>;
    const { getByTestId } = render(InspectorPropertiesFor(stairWithRuns, t));
    expect(getByTestId('inspector-stair-run-0')).toBeTruthy();
    expect(getByTestId('inspector-stair-run-1')).toBeTruthy();
  });

  it('changing run risers input dispatches updateStairRun', () => {
    const onDispatchCommand = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(stairInEditMode, t, { onDispatchCommand }),
    );
    const input = getByTestId('inspector-stair-run-risers-0') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12' } });
    expect(onDispatchCommand).toHaveBeenCalledOnce();
    const cmd = onDispatchCommand.mock.calls[0]![0] as Record<string, unknown>;
    expect(cmd.type).toBe('updateStairRun');
    expect(cmd.stairId).toBe('stair-edit-1');
    expect(cmd.runIndex).toBe(0);
    expect(cmd.riserCount).toBe(12);
  });
});
