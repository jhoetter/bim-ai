import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { LensDropdown } from './LensDropdown';

afterEach(() => {
  cleanup();
});

describe('LensDropdown — LNS-V3-01', () => {
  it('renders "Show: All ▾" initially', () => {
    const { getByTestId } = render(<LensDropdown currentLens="all" onLensChange={() => {}} />);
    expect(getByTestId('lens-dropdown-trigger').textContent).toContain('All');
    expect(getByTestId('lens-dropdown-trigger').textContent).toContain('▾');
  });

  it('click opens the lens menu including Coordination, Fire Safety, and Energieberatung', () => {
    const { getByTestId, queryByTestId } = render(
      <LensDropdown currentLens="all" onLensChange={() => {}} />,
    );
    expect(queryByTestId('lens-menu')).toBeNull();
    fireEvent.click(getByTestId('lens-dropdown-trigger'));
    const menu = queryByTestId('lens-menu');
    expect(menu).toBeTruthy();
    expect(menu!.querySelectorAll('[role="menuitem"]').length).toBe(7);
    expect(getByTestId('lens-option-coordination').textContent).toContain('Coordination');
    expect(getByTestId('lens-option-fire-safety').textContent).toContain('Fire Safety');
    expect(getByTestId('lens-option-energy').textContent).toContain('Energieberatung');
  });

  it('click "Structure" calls onLensChange("structure")', () => {
    const onLensChange = vi.fn();
    const { getByTestId } = render(<LensDropdown currentLens="all" onLensChange={onLensChange} />);
    fireEvent.click(getByTestId('lens-dropdown-trigger'));
    fireEvent.click(getByTestId('lens-option-structure'));
    expect(onLensChange).toHaveBeenCalledWith('structure');
  });

  it('L key cycles forward through the lens modes', () => {
    const onLensChange = vi.fn();
    render(<LensDropdown currentLens="all" onLensChange={onLensChange} />);
    fireEvent.keyDown(window, { key: 'L' });
    expect(onLensChange).toHaveBeenCalledWith('architecture');

    onLensChange.mockClear();
    render(<LensDropdown currentLens="architecture" onLensChange={onLensChange} />);
    fireEvent.keyDown(window, { key: 'L' });
    expect(onLensChange).toHaveBeenCalledWith('structure');

    onLensChange.mockClear();
    render(<LensDropdown currentLens="mep" onLensChange={onLensChange} />);
    fireEvent.keyDown(window, { key: 'L' });
    expect(onLensChange).toHaveBeenCalledWith('coordination');

    onLensChange.mockClear();
    render(<LensDropdown currentLens="coordination" onLensChange={onLensChange} />);
    fireEvent.keyDown(window, { key: 'L' });
    expect(onLensChange).toHaveBeenCalledWith('fire-safety');

    onLensChange.mockClear();
    render(<LensDropdown currentLens="fire-safety" onLensChange={onLensChange} />);
    fireEvent.keyDown(window, { key: 'L' });
    expect(onLensChange).toHaveBeenCalledWith('energy');

    onLensChange.mockClear();
    render(<LensDropdown currentLens="energy" onLensChange={onLensChange} />);
    fireEvent.keyDown(window, { key: 'L' });
    expect(onLensChange).toHaveBeenCalledWith('all');
  });

  it('surfaces the Coordination lens option', () => {
    const { getByTestId } = render(<LensDropdown currentLens="all" onLensChange={() => {}} />);
    fireEvent.click(getByTestId('lens-dropdown-trigger'));
    expect(getByTestId('lens-option-coordination').textContent).toContain('Coordination');
  });

  it('surfaces the Fire Safety lens option', () => {
    const { getByTestId } = render(<LensDropdown currentLens="all" onLensChange={() => {}} />);
    fireEvent.click(getByTestId('lens-dropdown-trigger'));
    expect(getByTestId('lens-option-fire-safety').textContent).toContain('Fire Safety');
  });
});
