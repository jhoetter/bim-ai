import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { StatusBar } from './StatusBar';

afterEach(() => {
  cleanup();
});

describe('StatusBar — spec §17', () => {
  it('renders all clusters', () => {
    const { getByText, getByLabelText } = render(
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
    const { getByText, getByRole } = render(
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
    const { getByText } = render(
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
    const { getByText } = render(
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
    const { getByText } = render(
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
    const { getByText } = render(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} wsState="offline" />,
    );
    const offline = getByText('offline');
    expect(offline.parentElement!.getAttribute('aria-live')).toBe('assertive');
  });

  it('uses aria-live="assertive" when save state is error', () => {
    const { getByText } = render(
      <StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} saveState="error" />,
    );
    const failed = getByText('save failed');
    expect(failed.getAttribute('aria-live')).toBe('assertive');
  });

  it('emits onUndo / onRedo for the undo cluster', () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const { getByLabelText } = render(
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
    const { getByLabelText } = render(<StatusBar level={{ id: 'lvl-ground', label: 'Ground' }} />);
    expect(getByLabelText('Cursor coordinates').textContent).toContain('X —');
  });
});
