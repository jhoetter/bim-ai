import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { StatusBar } from './StatusBar';
import i18n from '../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => {
  cleanup();
});

describe('StatusBar — spec §17', () => {
  it('renders all clusters', () => {
    const { getByText, getByLabelText } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        levels={[{ id: 'lvl-ground', label: 'Ground' }]}
        toolLabel="Wall"
        gridOn
        cursorMm={{ xMm: 12500, yMm: 8000 }}
        snapModes={[
          { id: 'endpoint', label: 'endpoint', on: true },
          { id: 'grid', label: 'grid', on: false },
        ]}
        wsState="connected"
        saveState="saved"
        undoDepth={4}
      />,
    );
    expect(getByText('Ground')).toBeTruthy();
    expect(getByText('Wall')).toBeTruthy();
    expect(getByText('endpoint')).toBeTruthy();
    expect(getByText('ON')).toBeTruthy();
    expect(getByLabelText('Cursor coordinates').textContent).toContain('X 12.50');
    expect(getByLabelText('Cursor coordinates').textContent).toContain('Y 8.00');
    expect(getByText('saved')).toBeTruthy();
    expect(getByText('connected')).toBeTruthy();
  });

  it('opens level popover and emits onLevelChange', () => {
    const onLevelChange = vi.fn();
    const { getByText, getByRole } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        levels={[
          { id: 'lvl-ground', label: 'Ground' },
          { id: 'lvl-upper', label: 'Upper' },
        ]}
        onLevelChange={onLevelChange}
      />,
    );
    fireEvent.click(getByText('Ground'));
    expect(getByRole('menu', { name: 'Levels' })).toBeTruthy();
    fireEvent.click(getByText('Upper'));
    expect(onLevelChange).toHaveBeenCalledWith('lvl-upper');
  });

  it('cycles levels with PageUp / PageDown', () => {
    const onLevelChange = vi.fn();
    const { getByText } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        levels={[
          { id: 'lvl-ground', label: 'Ground' },
          { id: 'lvl-upper', label: 'Upper' },
        ]}
        onLevelChange={onLevelChange}
      />,
    );
    fireEvent.keyDown(getByText('Ground').parentElement!, { key: 'PageDown' });
    expect(onLevelChange).toHaveBeenLastCalledWith('lvl-upper');
    fireEvent.keyDown(getByText('Ground').parentElement!, { key: 'PageUp' });
    expect(onLevelChange).toHaveBeenLastCalledWith('lvl-upper'); // wraps from idx=0
  });

  it('toggles snap modes via switch buttons', () => {
    const onSnapToggle = vi.fn();
    const { getByText } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        snapModes={[
          { id: 'endpoint', label: 'endpoint', on: true },
          { id: 'midpoint', label: 'midpoint', on: false },
        ]}
        onSnapToggle={onSnapToggle}
      />,
    );
    fireEvent.click(getByText('midpoint'));
    expect(onSnapToggle).toHaveBeenCalledWith('midpoint');
  });

  it('grid switch reflects state and emits onGridToggle', () => {
    const onGridToggle = vi.fn();
    const { getByText } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        gridOn={false}
        onGridToggle={onGridToggle}
      />,
    );
    expect(getByText('OFF')).toBeTruthy();
    fireEvent.click(getByText('OFF').parentElement!);
    expect(onGridToggle).toHaveBeenCalled();
  });

  it('uses aria-live="assertive" when ws is offline', () => {
    const { getByText } = renderWithI18n(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} wsState="offline" />,
    );
    const offline = getByText('offline');
    expect(offline.parentElement!.getAttribute('aria-live')).toBe('assertive');
  });

  it('uses aria-live="assertive" when save state is error', () => {
    const { getByText } = renderWithI18n(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} saveState="error" />,
    );
    const failed = getByText('save failed');
    expect(failed.getAttribute('aria-live')).toBe('assertive');
  });

  it('emits onUndo / onRedo for the undo cluster', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        undoDepth={2}
        onUndo={onUndo}
        onRedo={onRedo}
      />,
    );
    fireEvent.click(getByLabelText('Undo'));
    expect(onUndo).toHaveBeenCalled();
    fireEvent.click(getByLabelText('Redo'));
    expect(onRedo).toHaveBeenCalled();
  });

  it('renders a placeholder when cursor is off-canvas', () => {
    const { getByLabelText } = renderWithI18n(<StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} />);
    expect(getByLabelText('Cursor coordinates').textContent).toContain('X —');
  });
});

describe('StatusBar — conflict slot (T-10)', () => {
  const baseConflict = {
    format: 'collaborationConflictQueue_v1' as const,
    reason: 'merge_id_collision',
    firstBlockingCommandIndex: 0,
    firstBlockingCommandStep1Based: 1,
    blockingCommandType: 'create_wall',
    blockingRuleIds: ['rule-A'],
    affectedElementIds: ['el-1'],
    rows: [
      {
        ruleId: 'rule-A',
        elementIds: ['el-1'],
        severity: 'error' as const,
        blocking: true,
        message: 'ID collision',
      },
    ],
    inspectionReadout: 'Blocking step 1 (create_wall). Cross-check in Advisor.',
    inspectionReadoutSecondary: 'Retry: fix command references before re-applying.',
    retryAdvice: 'requires_manual_edit' as const,
    mergePreflightReadout: null,
    mergePreflightReadoutSecondary: null,
  };

  it('shows the conflict pill when conflictQueue is provided', () => {
    const { getByTestId } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        conflictQueue={baseConflict}
      />,
    );
    expect(getByTestId('conflict-pill')).toBeTruthy();
  });

  it('does not show the conflict pill when conflictQueue is null', () => {
    const { queryByTestId } = renderWithI18n(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} conflictQueue={null} />,
    );
    expect(queryByTestId('conflict-pill')).toBeNull();
  });

  it('expands the detail panel on click and shows inspectionReadout + retryAdvice + reason', () => {
    const { getByTestId } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        conflictQueue={baseConflict}
      />,
    );
    fireEvent.click(getByTestId('conflict-pill'));
    const panel = getByTestId('collaboration-conflict-queue-readout');
    expect(panel.textContent).toContain('Blocking step 1 (create_wall)');
    expect(panel.textContent).toContain('requires_manual_edit');
    expect(panel.textContent).toContain('merge_id_collision');
    expect(panel.textContent).toContain('create_wall');
  });

  it('shows the human-readable retry label in the pill badge', () => {
    const { getByTestId } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        conflictQueue={baseConflict}
      />,
    );
    expect(getByTestId('conflict-pill').textContent).toContain('manual edit');
  });

  it('calls onClearConflict and collapses when the dismiss button is clicked', () => {
    const onClearConflict = vi.fn();
    const { getByTestId } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        conflictQueue={baseConflict}
        onClearConflict={onClearConflict}
      />,
    );
    fireEvent.click(getByTestId('conflict-pill'));
    fireEvent.click(getByTestId('conflict-dismiss'));
    expect(onClearConflict).toHaveBeenCalled();
    expect(getByTestId('conflict-pill').getAttribute('aria-expanded')).toBe('false');
  });
});
