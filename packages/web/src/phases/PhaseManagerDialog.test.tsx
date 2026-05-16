import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { PhaseManagerDialog } from './PhaseManagerDialog';
import type { Element } from '@bim-ai/core';

afterEach(() => {
  cleanup();
});

function makePhase(id: string, name: string, ord: number, description = ''): Element {
  return { kind: 'phase', id, name, ord, description } as Element;
}

function makeWall(id: string, phaseId: string): Element {
  return { kind: 'wall', id, phaseId } as unknown as Element;
}

const baseElements: Record<string, Element> = {
  'phase-existing': makePhase('phase-existing', 'Existing', 0, 'Bestand'),
  'phase-demo': makePhase('phase-demo', 'Demolition', 1),
  'phase-new': makePhase('phase-new', 'New Construction', 2),
};

describe('PhaseManagerDialog', () => {
  it('renders phases in sequence order', () => {
    render(
      <PhaseManagerDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements}
        onSemanticCommand={vi.fn()}
      />,
    );
    const rows = screen.getAllByTestId(/^phase-row-/);
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('Existing');
    expect(rows[1].textContent).toContain('Demolition');
    expect(rows[2].textContent).toContain('New Construction');
  });

  it('shows element count per phase', () => {
    const elements: Record<string, Element> = {
      ...baseElements,
      wall1: makeWall('wall1', 'phase-existing'),
      wall2: makeWall('wall2', 'phase-existing'),
      wall3: makeWall('wall3', 'phase-new'),
    };
    render(
      <PhaseManagerDialog
        open
        onClose={vi.fn()}
        elementsById={elements}
        onSemanticCommand={vi.fn()}
      />,
    );
    const existingRow = screen.getByTestId('phase-row-phase-existing');
    expect(existingRow.textContent).toContain('2');
    const newRow = screen.getByTestId('phase-row-phase-new');
    expect(newRow.textContent).toContain('1');
  });

  it('dispatches createPhase when add is clicked', async () => {
    const dispatch = vi.fn();
    render(
      <PhaseManagerDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements}
        onSemanticCommand={dispatch}
      />,
    );
    fireEvent.change(screen.getByTestId('phase-new-name'), { target: { value: 'Renovation' } });
    fireEvent.click(screen.getByTestId('phase-add-btn'));
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    const cmd = dispatch.mock.calls[0][0] as Record<string, unknown>;
    expect(cmd.type).toBe('createPhase');
    expect(cmd.name).toBe('Renovation');
    expect(typeof cmd.id).toBe('string');
    expect(cmd.ord).toBe(3);
  });

  it('dispatches updateElementProperty on rename', async () => {
    const dispatch = vi.fn();
    render(
      <PhaseManagerDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements}
        onSemanticCommand={dispatch}
      />,
    );
    fireEvent.click(screen.getByText('Existing'));
    const input = screen.getByTestId('phase-edit-name');
    fireEvent.change(input, { target: { value: 'Bestand (renamed)' } });
    fireEvent.click(screen.getByTestId('phase-save-btn'));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const cmd = dispatch.mock.calls[0][0] as Record<string, unknown>;
    expect(cmd.type).toBe('updateElementProperty');
    expect(cmd.elementId).toBe('phase-existing');
    expect(cmd.key).toBe('name');
    expect(cmd.value).toBe('Bestand (renamed)');
  });

  it('shows delete confirmation with element count warning', () => {
    const elements: Record<string, Element> = {
      ...baseElements,
      wall1: makeWall('wall1', 'phase-existing'),
    };
    render(
      <PhaseManagerDialog
        open
        onClose={vi.fn()}
        elementsById={elements}
        onSemanticCommand={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('phase-delete-phase-existing'));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText(/1 element.*assigned/)).toBeTruthy();
  });

  it('dispatches deleteElement after confirmation', async () => {
    const dispatch = vi.fn();
    render(
      <PhaseManagerDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements}
        onSemanticCommand={dispatch}
      />,
    );
    fireEvent.click(screen.getByTestId('phase-delete-phase-demo'));
    fireEvent.click(screen.getByTestId('phase-confirm-delete'));
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    const cmd = dispatch.mock.calls[0][0] as Record<string, unknown>;
    expect(cmd.type).toBe('deleteElement');
    expect(cmd.elementId).toBe('phase-demo');
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <PhaseManagerDialog
        open
        onClose={onClose}
        elementsById={baseElements}
        onSemanticCommand={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns null when closed', () => {
    const { container } = render(
      <PhaseManagerDialog
        open={false}
        onClose={vi.fn()}
        elementsById={baseElements}
        onSemanticCommand={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
