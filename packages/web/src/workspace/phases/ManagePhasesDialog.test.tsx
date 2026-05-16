import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { ManagePhasesDialog } from './ManagePhasesDialog';
import type { Element } from '@bim-ai/core';

afterEach(() => {
  cleanup();
});

type PhaseEl = Extract<Element, { kind: 'phase' }>;

function makePhase(id: string, name: string, ord: number): PhaseEl {
  return { kind: 'phase', id, name, ord } as PhaseEl;
}

const basePhases: PhaseEl[] = [
  makePhase('phase-existing', 'Existing', 0),
  makePhase('phase-demo', 'Demolition', 1),
  makePhase('phase-new', 'New Construction', 2),
];

const defaultProps = {
  isOpen: true,
  phases: basePhases,
  onCreatePhase: vi.fn(),
  onUpdatePhase: vi.fn(),
  onDeletePhase: vi.fn(),
  onClose: vi.fn(),
};

describe('ManagePhasesDialog', () => {
  it('renders existing phase rows with name and delete button', () => {
    render(<ManagePhasesDialog {...defaultProps} />);
    expect(screen.getByTestId('manage-phases-row-phase-existing')).toBeTruthy();
    expect(screen.getByTestId('manage-phases-row-phase-demo')).toBeTruthy();
    expect(screen.getByTestId('manage-phases-row-phase-new')).toBeTruthy();
    expect(screen.getByTestId('manage-phases-delete-phase-existing')).toBeTruthy();
    expect(screen.getByTestId('manage-phases-delete-phase-demo')).toBeTruthy();
  });

  it('dispatches create_phase command with next sequenceIndex when Add Phase is clicked', () => {
    const onCreatePhase = vi.fn();
    render(<ManagePhasesDialog {...defaultProps} onCreatePhase={onCreatePhase} />);
    fireEvent.click(screen.getByTestId('manage-phases-add'));
    expect(onCreatePhase).toHaveBeenCalledTimes(1);
    const cmd = onCreatePhase.mock.calls[0][0] as { id: string; name: string; ord: number };
    expect(cmd.name).toBe('New Phase');
    expect(cmd.ord).toBe(3);
    expect(typeof cmd.id).toBe('string');
  });

  it('dispatches update_phase on blur when name is edited', () => {
    const onUpdatePhase = vi.fn();
    render(<ManagePhasesDialog {...defaultProps} onUpdatePhase={onUpdatePhase} />);
    const row = screen.getByTestId('manage-phases-row-phase-existing');
    const input = row.querySelector('input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Existing (renamed)' } });
    fireEvent.blur(input);
    expect(onUpdatePhase).toHaveBeenCalledWith({
      id: 'phase-existing',
      name: 'Existing (renamed)',
    });
  });

  it('dispatches delete_phase with correct id when Delete is clicked', () => {
    const onDeletePhase = vi.fn();
    render(<ManagePhasesDialog {...defaultProps} onDeletePhase={onDeletePhase} />);
    fireEvent.click(screen.getByTestId('manage-phases-delete-phase-demo'));
    expect(onDeletePhase).toHaveBeenCalledWith('phase-demo');
  });
});
