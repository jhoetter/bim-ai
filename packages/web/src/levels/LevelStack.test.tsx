import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { LevelStack } from './LevelStack';
import type { Element } from '@bim-ai/core';

type Level = Extract<Element, { kind: 'level' }>;

afterEach(() => {
  cleanup();
});

function makeLevel(id: string, name: string, elevationMm: number): Level {
  return { kind: 'level', id, name, elevationMm };
}

const defaultProps = {
  activeId: 'l1',
  setActive: vi.fn(),
  onElevationCommitted: vi.fn(),
};

describe('<LevelStack /> — Add Multiple Levels (C5)', () => {
  it('does not show "Add Multiple" button when onCreateMultipleLevels is not provided', () => {
    const levels = [makeLevel('l1', 'EG', 0), makeLevel('l2', 'OG 1', 3000)];
    const { queryByTestId } = render(<LevelStack {...defaultProps} levels={levels} />);
    expect(queryByTestId('level-stack-create-multiple')).toBeNull();
  });

  it('shows "Add Multiple" button when onCreateMultipleLevels is provided', () => {
    const levels = [makeLevel('l1', 'EG', 0), makeLevel('l2', 'OG 1', 3000)];
    const onCreateMultipleLevels = vi.fn();
    const { getByTestId } = render(
      <LevelStack
        {...defaultProps}
        levels={levels}
        onCreateMultipleLevels={onCreateMultipleLevels}
      />,
    );
    expect(getByTestId('level-stack-create-multiple')).toBeTruthy();
  });

  it('opens the dialog when the button is clicked', () => {
    const levels = [makeLevel('l1', 'EG', 0)];
    const onCreateMultipleLevels = vi.fn();
    const { getByTestId } = render(
      <LevelStack
        {...defaultProps}
        levels={levels}
        onCreateMultipleLevels={onCreateMultipleLevels}
      />,
    );
    fireEvent.click(getByTestId('level-stack-create-multiple'));
    expect(getByTestId('multi-level-count')).toBeTruthy();
  });

  it('calls onCreateMultipleLevels with correct entries (count=4, spacing=2800)', () => {
    const levels = [makeLevel('l1', 'EG', 0), makeLevel('l2', 'OG 1', 3000)];
    const onCreateMultipleLevels = vi.fn();
    const { getByTestId } = render(
      <LevelStack
        {...defaultProps}
        levels={levels}
        onCreateMultipleLevels={onCreateMultipleLevels}
      />,
    );

    fireEvent.click(getByTestId('level-stack-create-multiple'));
    fireEvent.change(getByTestId('multi-level-count'), { target: { value: '4' } });
    fireEvent.change(getByTestId('multi-level-spacing'), { target: { value: '2800' } });
    fireEvent.click(getByTestId('multi-level-create'));

    expect(onCreateMultipleLevels).toHaveBeenCalledOnce();
    const [calledLevels] = onCreateMultipleLevels.mock.calls[0] as [
      Array<{ name: string; elevationMm: number }>,
    ];

    expect(calledLevels).toHaveLength(4);

    // topExistingLevelElevMm = 3000 (max of EG=0, OG1=3000)
    expect(calledLevels[0]).toEqual({ name: 'Ebene 1', elevationMm: 3000 + 2800 * 1 });
    expect(calledLevels[1]).toEqual({ name: 'Ebene 2', elevationMm: 3000 + 2800 * 2 });
    expect(calledLevels[2]).toEqual({ name: 'Ebene 3', elevationMm: 3000 + 2800 * 3 });
    expect(calledLevels[3]).toEqual({ name: 'Ebene 4', elevationMm: 3000 + 2800 * 4 });
  });

  it('uses 0 as base elevation when no levels exist', () => {
    const onCreateMultipleLevels = vi.fn();
    const { getByTestId } = render(
      <LevelStack
        {...defaultProps}
        levels={[]}
        activeId=""
        onCreateMultipleLevels={onCreateMultipleLevels}
      />,
    );

    fireEvent.click(getByTestId('level-stack-create-multiple'));
    fireEvent.click(getByTestId('multi-level-create'));

    expect(onCreateMultipleLevels).toHaveBeenCalledOnce();
    const [calledLevels] = onCreateMultipleLevels.mock.calls[0] as [
      Array<{ name: string; elevationMm: number }>,
    ];

    // default count=3, spacing=3000, base=0
    expect(calledLevels).toHaveLength(3);
    expect(calledLevels[0]).toEqual({ name: 'Ebene 1', elevationMm: 3000 });
    expect(calledLevels[1]).toEqual({ name: 'Ebene 2', elevationMm: 6000 });
    expect(calledLevels[2]).toEqual({ name: 'Ebene 3', elevationMm: 9000 });
  });

  it('closes the dialog when the toggle button is clicked again', () => {
    const levels = [makeLevel('l1', 'EG', 0)];
    const onCreateMultipleLevels = vi.fn();
    const { getByTestId, queryByTestId } = render(
      <LevelStack
        {...defaultProps}
        levels={levels}
        onCreateMultipleLevels={onCreateMultipleLevels}
      />,
    );

    fireEvent.click(getByTestId('level-stack-create-multiple'));
    expect(getByTestId('multi-level-count')).toBeTruthy();

    fireEvent.click(getByTestId('level-stack-create-multiple'));
    expect(queryByTestId('multi-level-count')).toBeNull();
  });
});
