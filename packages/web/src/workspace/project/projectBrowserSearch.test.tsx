import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { ProjectBrowserV3 } from './ProjectBrowser';

afterEach(() => {
  cleanup();
});

function makeProps(elements: Array<Record<string, unknown>> = []) {
  return {
    elements: elements as unknown as Element[],
    activeViewId: null as string | null,
    onActivateView: () => {},
    onRenameView: () => {},
    onDeleteView: () => {},
    onDuplicateView: () => {},
  };
}

const pv1 = {
  kind: 'plan_view',
  id: 'pv1',
  name: 'Ground Floor Plan',
  levelId: 'l1',
  viewType: 'floor_plan',
  disciplineKey: 'architectural',
};
const pv2 = {
  kind: 'plan_view',
  id: 'pv2',
  name: 'Roof Plan',
  levelId: 'l2',
  viewType: 'floor_plan',
  disciplineKey: 'architectural',
};

describe('ProjectBrowser search/filter — §1.6.11', () => {
  it('renders the browser search input', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    expect(getByTestId('browser-search-input')).toBeTruthy();
  });

  it('renders sort button for plan views', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    expect(getByTestId('browser-plan-views-sort-btn')).toBeTruthy();
  });

  it('typing in search input changes its value', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    const input = getByTestId('browser-search-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Ground' } });
    expect(input.value).toBe('Ground');
  });

  it('sort button toggles label on click', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    const btn = getByTestId('browser-plan-views-sort-btn');
    const initialText = btn.textContent;
    fireEvent.click(btn);
    expect(btn.textContent).not.toBe(initialText);
  });
});
