/**
 * TOP-V3-03 — SubdivisionPalette tests
 *
 * Verifies:
 * 1. Renders 5 category buttons
 * 2. Active category is highlighted (aria-pressed + accent bg via CSS var)
 * 3. Clicking a category calls onSelect with correct id
 * 4. Escape calls onCancel
 * 5. Zero hex literals in rendered output
 * 6. All buttons have aria-label
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { SubdivisionPalette } from './SubdivisionPalette';
import type { SubdivisionCategory } from './SubdivisionPalette';

afterEach(() => {
  cleanup();
});

function renderPalette(
  props: Partial<{
    activeCategory: SubdivisionCategory;
    onSelect: (cat: SubdivisionCategory) => void;
    onCancel: () => void;
  }> = {},
) {
  const onSelect = props.onSelect ?? vi.fn();
  const onCancel = props.onCancel ?? vi.fn();
  const activeCategory = props.activeCategory ?? 'paving';
  return render(
    <SubdivisionPalette
      activeCategory={activeCategory}
      onSelect={onSelect}
      onCancel={onCancel}
    />,
  );
}

describe('SubdivisionPalette — TOP-V3-03', () => {
  it('renders exactly 5 category buttons', () => {
    const { getAllByRole } = renderPalette();
    const buttons = getAllByRole('button');
    expect(buttons).toHaveLength(5);
  });

  it('active category button has aria-pressed="true"', () => {
    const { getByLabelText } = renderPalette({ activeCategory: 'lawn' });
    const lawnBtn = getByLabelText('Lawn') as HTMLButtonElement;
    expect(lawnBtn.getAttribute('aria-pressed')).toBe('true');
    const pavingBtn = getByLabelText('Paving') as HTMLButtonElement;
    expect(pavingBtn.getAttribute('aria-pressed')).toBe('false');
  });

  it('active category button uses CSS var accent background (no hex literal)', () => {
    const { getByLabelText } = renderPalette({ activeCategory: 'road' });
    const roadBtn = getByLabelText('Road') as HTMLButtonElement;
    const bg = roadBtn.style.background || roadBtn.style.backgroundColor;
    expect(bg).toMatch(/var\(--color-accent/);
    expect(bg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('clicking a category calls onSelect with the correct id', () => {
    const onSelect = vi.fn();
    const { getByLabelText } = renderPalette({ onSelect });
    fireEvent.click(getByLabelText('Planting'));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onSelect).toHaveBeenCalledWith('planting');
  });

  it('pressing Escape calls onCancel', () => {
    const onCancel = vi.fn();
    renderPalette({ onCancel });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('zero hex colour literals in inline styles of rendered output', () => {
    const { container } = renderPalette();
    const html = container.innerHTML;
    // Hex colour literals look like #rgb or #rrggbb (or 8-digit)
    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}(?=[^0-9a-fA-F]|$)/);
  });

  it('all buttons have an aria-label', () => {
    const { getAllByRole } = renderPalette();
    const buttons = getAllByRole('button') as HTMLButtonElement[];
    for (const btn of buttons) {
      expect(btn.getAttribute('aria-label')).toBeTruthy();
    }
  });
});
