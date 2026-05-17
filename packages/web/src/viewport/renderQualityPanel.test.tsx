import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { useBimStore } from '../state/store';
import { RenderQualityPanel } from './RenderQualityPanel';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useBimStore.setState({
    renderQuality: { shadowsEnabled: false, toneMappingExposure: 1.0, pixelRatioScale: 'auto' },
  });
});

describe('RenderQualityPanel — §14.3', () => {
  it('renders the panel with shadows checkbox', () => {
    render(<RenderQualityPanel onClose={() => {}} />);
    expect(screen.getByTestId('render-quality-panel')).toBeTruthy();
    expect(screen.getByTestId('render-quality-shadows')).toBeTruthy();
  });

  it('renders exposure slider', () => {
    render(<RenderQualityPanel onClose={() => {}} />);
    const slider = screen.getByTestId('render-quality-exposure') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.min).toBe('0.5');
    expect(slider.max).toBe('3');
  });

  it('renders pixel ratio select', () => {
    render(<RenderQualityPanel onClose={() => {}} />);
    const select = screen.getByTestId('render-quality-pixel-ratio') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('auto');
  });

  it('renders close button', () => {
    render(<RenderQualityPanel onClose={() => {}} />);
    expect(screen.getByTestId('render-quality-close')).toBeTruthy();
  });

  it('calls setRenderQuality when shadows toggled', () => {
    const setRenderQuality = vi.fn();
    useBimStore.setState({ setRenderQuality } as unknown as ReturnType<
      typeof useBimStore.getState
    >);

    render(<RenderQualityPanel onClose={() => {}} />);
    fireEvent.click(screen.getByTestId('render-quality-shadows'));
    expect(setRenderQuality).toHaveBeenCalledWith({ shadowsEnabled: true });
  });

  it('displays exposure value label', () => {
    render(<RenderQualityPanel onClose={() => {}} />);
    expect(screen.getByTestId('render-quality-exposure-value').textContent).toBe('1.0×');
  });
});
