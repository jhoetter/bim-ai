import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { StatusBar } from './StatusBar';
import i18n from '../../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => {
  cleanup();
});

describe('StatusBar — spec §17', () => {
  it('renders all clusters', () => {
    const { getByText, getByLabelText, getByTitle } = renderWithI18n(
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
    expect(getByText('Drawing wall')).toBeTruthy();
    // Snap chips now render single-character glyphs (E = endpoint, G = grid)
    expect(getByTitle('Endpoint snap (on)')).toBeTruthy();
    expect(getByTitle('Grid (F7)').getAttribute('aria-checked')).toBe('true');
    expect(getByLabelText('Cursor coordinates').textContent).toContain('X 12.500 m');
    expect(getByLabelText('Cursor coordinates').textContent).toContain('Y 8.000 m');
    expect(getByText('saved')).toBeTruthy();
    expect(getByTitle('Connection: connected')).toBeTruthy();
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
    const { getByTitle } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        snapModes={[
          { id: 'endpoint', label: 'endpoint', on: true },
          { id: 'midpoint', label: 'midpoint', on: false },
        ]}
        onSnapToggle={onSnapToggle}
      />,
    );
    // Snap chips now render single-character glyphs; find by title tooltip
    fireEvent.click(getByTitle('Midpoint snap (off)'));
    expect(onSnapToggle).toHaveBeenCalledWith('midpoint');
  });

  it('shows advisor severity count and opens the footer advisor entry — UX-WP-08', () => {
    const onAdvisorClick = vi.fn();
    const { getByTestId, getByLabelText } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        advisorCounts={{ error: 1, warning: 2, info: 3 }}
        onAdvisorClick={onAdvisorClick}
      />,
    );

    expect(getByTestId('status-bar-advisor-entry').textContent).toContain('1 error');
    expect(getByTestId('status-bar-advisor-badge').textContent).toBe('6');
    fireEvent.click(getByLabelText('Advisor: 1 errors, 2 warnings, 3 info'));
    expect(onAdvisorClick).toHaveBeenCalledTimes(1);
  });

  it('grid switch reflects state and emits onGridToggle', () => {
    const onGridToggle = vi.fn();
    const { getByTitle } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        gridOn={false}
        onGridToggle={onGridToggle}
      />,
    );
    const gridSwitch = getByTitle('Grid (F7)');
    expect(gridSwitch.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(gridSwitch);
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
        redoDepth={1}
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
    const { getByLabelText } = renderWithI18n(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} />,
    );
    expect(getByLabelText('Cursor coordinates').textContent).toContain('X —');
  });

  it('renders scoped view label and detail chips outside plan-like modes', () => {
    const { getByTestId, getByText, queryByLabelText } = renderWithI18n(
      <StatusBar
        mode="3d"
        viewLabel="Default 3D"
        viewDetails={['Perspective', 'Section box', 'Selected wall']}
        level={{ id: 'lvl-ground', label: 'Ground' }}
      />,
    );
    expect(getByTestId('statusbar-view-mode').textContent).toContain('3D');
    expect(getByText('Default 3D')).toBeTruthy();
    expect(getByText('Perspective')).toBeTruthy();
    expect(getByText('Section box')).toBeTruthy();
    expect(queryByLabelText('Cursor coordinates')).toBeNull();
  });
});

describe('StatusBar — CHR-V3-03 lens dropdown + drift badge', () => {
  it('shows "Show: All" by default', () => {
    const { getByTestId } = renderWithI18n(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} />,
    );
    expect(getByTestId('lens-dropdown-trigger').textContent).toContain('Show:');
    expect(getByTestId('lens-dropdown-trigger').textContent).toContain('All');
  });

  it('opens the lens menu on click', () => {
    const { getByTestId } = renderWithI18n(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} />,
    );
    fireEvent.click(getByTestId('lens-dropdown-trigger'));
    expect(getByTestId('lens-menu')).toBeTruthy();
  });

  it('calls onLensChange with "structure" when Structure is selected', () => {
    const onLensChange = vi.fn();
    const { getByTestId } = renderWithI18n(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} onLensChange={onLensChange} />,
    );
    fireEvent.click(getByTestId('lens-dropdown-trigger'));
    fireEvent.click(getByTestId('lens-option-structure'));
    expect(onLensChange).toHaveBeenCalledWith('structure');
  });

  it('hides DriftBadge when driftCount is 0', () => {
    const { queryByTestId } = renderWithI18n(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} driftCount={0} />,
    );
    expect(queryByTestId('drift-badge')).toBeNull();
  });

  it('shows DriftBadge with count when driftCount is 3', () => {
    const { getByTestId } = renderWithI18n(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} driftCount={3} />,
    );
    expect(getByTestId('drift-badge').textContent).toContain('3 drifts');
  });

  it('calls onDriftClick when DriftBadge is clicked', () => {
    const onDriftClick = vi.fn();
    const { getByTestId } = renderWithI18n(
      <StatusBar
        level={{ id: 'lvl-ground', label: 'Ground' }}
        driftCount={1}
        onDriftClick={onDriftClick}
      />,
    );
    fireEvent.click(getByTestId('drift-badge'));
    expect(onDriftClick).toHaveBeenCalled();
  });

  it('LNS-V3-02 applies the active workspace tint stripe', () => {
    const { getByTestId } = renderWithI18n(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} activeWorkspaceId="struct" />,
    );
    expect(getByTestId('status-bar').getAttribute('style')).toContain('var(--disc-struct)');
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
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} conflictQueue={baseConflict} />,
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
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} conflictQueue={baseConflict} />,
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
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} conflictQueue={baseConflict} />,
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
