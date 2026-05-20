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

const level1 = { kind: 'level', id: 'l1', name: 'Ground Floor', elevationMm: 0 };
const level2 = { kind: 'level', id: 'l2', name: 'First Floor', elevationMm: 3000 };
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
  name: 'First Floor Plan',
  levelId: 'l2',
  viewType: 'floor_plan',
  disciplineKey: 'architectural',
};

describe('ProjectBrowser org preset — §1.6.11', () => {
  it('renders the view org preset select', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    expect(getByTestId('browser-view-org-preset')).toBeTruthy();
  });

  it('defaults to discipline grouping', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2])} />);
    const select = getByTestId('browser-view-org-preset') as HTMLSelectElement;
    expect(select.value).toBe('discipline');
  });

  it('switching to "level" changes the select value', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps([pv1, pv2, level1, level2])} />);
    const select = getByTestId('browser-view-org-preset');
    fireEvent.change(select, { target: { value: 'level' } });
    expect((select as HTMLSelectElement).value).toBe('level');
  });
});
