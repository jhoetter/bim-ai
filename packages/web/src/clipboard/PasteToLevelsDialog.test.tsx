import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Element } from '@bim-ai/core';

import { PasteToLevelsDialog } from './PasteToLevelsDialog';

afterEach(() => {
  cleanup();
});

function makeLevel(id: string, name: string, elevationMm: number): Element {
  return { kind: 'level', id, name, elevationMm } as unknown as Element;
}

const baseElements: Record<string, Element> = {
  'level-gf': makeLevel('level-gf', 'Ground Floor', 0),
  'level-l1': makeLevel('level-l1', 'Level 1', 3000),
  'level-l2': makeLevel('level-l2', 'Level 2', 6000),
};

describe('PasteToLevelsDialog', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <PasteToLevelsDialog
        open={false}
        onClose={vi.fn()}
        elementsById={baseElements}
        activeLevelId="level-gf"
        selectedElementIds={['el-1']}
        onSemanticCommand={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('lists levels excluding the active level', () => {
    render(
      <PasteToLevelsDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements}
        activeLevelId="level-gf"
        selectedElementIds={['el-1']}
        onSemanticCommand={vi.fn()}
      />,
    );
    const list = screen.getByTestId('paste-to-levels-list');
    expect(list.textContent).toContain('Level 1');
    expect(list.textContent).toContain('Level 2');
    expect(list.textContent).not.toContain('Ground Floor');
  });

  it('shows empty state when no other levels', () => {
    const onlyOne: Record<string, Element> = {
      'level-gf': makeLevel('level-gf', 'Ground Floor', 0),
    };
    render(
      <PasteToLevelsDialog
        open
        onClose={vi.fn()}
        elementsById={onlyOne}
        activeLevelId="level-gf"
        selectedElementIds={['el-1']}
        onSemanticCommand={vi.fn()}
      />,
    );
    expect(screen.getByTestId('paste-to-levels-no-levels').textContent).toContain(
      'No other levels available',
    );
  });

  it('confirm button disabled when no levels checked', () => {
    render(
      <PasteToLevelsDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements}
        activeLevelId="level-gf"
        selectedElementIds={['el-1']}
        onSemanticCommand={vi.fn()}
      />,
    );
    const btn = screen.getByTestId('paste-to-levels-confirm') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('dispatches copyElementsToLevels command for checked levels', async () => {
    const dispatch = vi.fn();
    render(
      <PasteToLevelsDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements}
        activeLevelId="level-gf"
        selectedElementIds={['el-1']}
        onSemanticCommand={dispatch}
      />,
    );
    fireEvent.click(screen.getByTestId('paste-to-levels-check-level-l1'));
    fireEvent.click(screen.getByTestId('paste-to-levels-confirm'));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const cmd = dispatch.mock.calls[0][0] as Record<string, unknown>;
    expect(cmd.type).toBe('copyElementsToLevels');
    expect(cmd.sourceLevelId).toBe('level-gf');
    expect(cmd.targetLevelIds as string[]).toContain('level-l1');
    expect(cmd.elementIds).toContain('el-1');
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <PasteToLevelsDialog
        open
        onClose={onClose}
        elementsById={baseElements}
        activeLevelId="level-gf"
        selectedElementIds={['el-1']}
        onSemanticCommand={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on overlay click', () => {
    const onClose = vi.fn();
    render(
      <PasteToLevelsDialog
        open
        onClose={onClose}
        elementsById={baseElements}
        activeLevelId="level-gf"
        selectedElementIds={['el-1']}
        onSemanticCommand={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('paste-to-levels-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dispatches one command per checked target level', async () => {
    const dispatch = vi.fn();
    render(
      <PasteToLevelsDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements}
        activeLevelId="level-gf"
        selectedElementIds={['el-1']}
        onSemanticCommand={dispatch}
      />,
    );
    fireEvent.click(screen.getByTestId('paste-to-levels-check-level-l1'));
    fireEvent.click(screen.getByTestId('paste-to-levels-check-level-l2'));
    fireEvent.click(screen.getByTestId('paste-to-levels-confirm'));
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
  });
});
