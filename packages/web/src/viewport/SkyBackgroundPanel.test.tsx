import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { useBimStore } from '../state/store';
import { SkyBackgroundPanel } from './SkyBackgroundPanel';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useBimStore.setState({
    skyBackground: 'default',
    // eslint-disable-next-line bim-ai/no-hex-in-chrome
    skyBackgroundColor: '#87ceeb',
  });
});

describe('sky background panel — §14.4', () => {
  it('does not render when open=false', () => {
    const { container } = render(<SkyBackgroundPanel open={false} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders sky-background-panel when open=true', () => {
    render(<SkyBackgroundPanel open={true} onClose={() => {}} />);
    expect(screen.getByTestId('sky-background-panel')).toBeTruthy();
  });

  it('has radio buttons for all 4 modes', () => {
    render(<SkyBackgroundPanel open={true} onClose={() => {}} />);
    expect(screen.getByTestId('sky-mode-default')).toBeTruthy();
    expect(screen.getByTestId('sky-mode-gradient-sky')).toBeTruthy();
    expect(screen.getByTestId('sky-mode-overcast')).toBeTruthy();
    expect(screen.getByTestId('sky-mode-solid')).toBeTruthy();
  });

  it('shows color picker only when solid mode is selected', () => {
    const { rerender } = render(<SkyBackgroundPanel open={true} onClose={() => {}} />);
    // Default mode — no color picker
    expect(screen.queryByTestId('sky-solid-color')).toBeNull();

    // Switch to solid
    useBimStore.setState({ skyBackground: 'solid' });
    rerender(<SkyBackgroundPanel open={true} onClose={() => {}} />);
    expect(screen.getByTestId('sky-solid-color')).toBeTruthy();

    // Switch back to gradient-sky — no color picker
    useBimStore.setState({ skyBackground: 'gradient-sky' });
    rerender(<SkyBackgroundPanel open={true} onClose={() => {}} />);
    expect(screen.queryByTestId('sky-solid-color')).toBeNull();
  });

  it('clicking a mode radio calls setSkyBackground', () => {
    const setSkyBackground = vi.fn();
    useBimStore.setState({ setSkyBackground } as unknown as ReturnType<
      typeof useBimStore.getState
    >);

    render(<SkyBackgroundPanel open={true} onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('sky-mode-gradient-sky'));
    expect(setSkyBackground).toHaveBeenCalledWith('gradient-sky');
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<SkyBackgroundPanel open={true} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('sky-panel-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
