import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ViewCube } from './ViewCube';

afterEach(() => {
  cleanup();
});

describe('<ViewCube /> — spec §15.4', () => {
  it('renders six face buttons', () => {
    const { getByLabelText } = render(<ViewCube currentAzimuth={0} onPick={() => undefined} />);
    for (const face of ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM']) {
      expect(getByLabelText(`Align camera to ${face}`)).toBeTruthy();
    }
  });

  it('emits onPick with the right alignment when a face is clicked', () => {
    const onPick = vi.fn();
    const { getByLabelText } = render(<ViewCube currentAzimuth={0} onPick={onPick} />);
    fireEvent.click(getByLabelText('Align camera to TOP'));
    expect(onPick).toHaveBeenCalled();
    const [pick, alignment] = onPick.mock.calls[0]!;
    expect(pick).toEqual({ kind: 'face', face: 'TOP' });
    expect(alignment.up).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('home button emits a `home` pick and onHome', () => {
    const onPick = vi.fn();
    const onHome = vi.fn();
    const { getByLabelText } = render(
      <ViewCube currentAzimuth={0} onPick={onPick} onHome={onHome} />,
    );
    fireEvent.click(getByLabelText('Reset to default view'));
    expect(onPick.mock.calls[0]![0]).toEqual({ kind: 'home' });
    expect(onHome).toHaveBeenCalled();
  });

  it('corner buttons emit corner picks', () => {
    const onPick = vi.fn();
    const { getByLabelText } = render(<ViewCube currentAzimuth={0} onPick={onPick} />);
    fireEvent.click(getByLabelText('Align camera to TOP-NE'));
    expect(onPick.mock.calls[0]![0]).toEqual({ kind: 'corner', corner: 'TOP-NE' });
  });

  it('compass label reflects currentAzimuth', () => {
    const { getByTestId, rerender } = render(
      <ViewCube currentAzimuth={0} onPick={() => undefined} />,
    );
    expect(getByTestId('view-cube-compass').dataset.cardinal).toBe('N');
    rerender(<ViewCube currentAzimuth={Math.PI / 2} onPick={() => undefined} />);
    expect(getByTestId('view-cube-compass').dataset.cardinal).toBe('E');
  });
});
