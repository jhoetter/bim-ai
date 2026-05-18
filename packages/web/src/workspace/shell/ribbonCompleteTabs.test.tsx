import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, type RenderResult } from '@testing-library/react';

import { RibbonBar, ribbonCommandReachabilityForMode } from './RibbonBar';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function tabLabels(result: RenderResult): string[] {
  return result.getAllByRole('tab').map((tab) => tab.textContent ?? '');
}

function expectTabWithCommands(result: RenderResult, tabId: string): void {
  const tab = result.getByTestId(`ribbon-tab-${tabId}`);
  fireEvent.click(tab);
  expect(tab.getAttribute('aria-selected')).toBe('true');

  const buttons = Array.from(
    result.getByTestId('ribbon-panels').querySelectorAll('button'),
  ) as HTMLButtonElement[];
  expect(buttons.length).toBeGreaterThan(0);
  expect(buttons.some((button) => (button.textContent ?? '').trim().length > 0)).toBe(true);
}

describe('RibbonBar complete tab schema — Wave 33 WP-C', () => {
  it('exposes the completed professional plan tabs and each opens commands', () => {
    const result = render(<RibbonBar activeMode="plan" activeToolId="wall" />);

    expect(tabLabels(result)).toEqual(
      expect.arrayContaining([
        'Create',
        'Systems',
        'Insert',
        'Annotate',
        'Review',
        'Collaborate',
        'View',
        'Manage',
        'Steel',
        'Precast',
        'Massing & Site',
      ]),
    );

    for (const tabId of [
      'create',
      'systems',
      'insert',
      'annotate',
      'review',
      'collaborate',
      'view',
      'manage',
      'steel',
      'precast',
      'massing-site',
    ]) {
      expectTabWithCommands(result, tabId);
    }
  });

  it('keeps direct 3D model tools and exposes view, insert, review, collaborate, and manage tabs', () => {
    const result = render(<RibbonBar activeMode="3d" activeToolId="wall" />);

    expect(result.getByRole('tab', { name: 'Model' }).getAttribute('aria-selected')).toBe('true');
    expect(result.getByTestId('ribbon-command-wall')).toBeTruthy();
    expect(result.getByTestId('ribbon-command-floor')).toBeTruthy();
    expect(result.getByTestId('ribbon-command-roof')).toBeTruthy();
    expect(result.getByTestId('ribbon-command-column')).toBeTruthy();
    expect(result.getByTestId('ribbon-command-beam')).toBeTruthy();

    expect(tabLabels(result)).toEqual(
      expect.arrayContaining([
        'Model',
        'Systems',
        '3D View',
        'Insert',
        'Analyze',
        'Collaborate',
        'Manage',
      ]),
    );

    for (const tabId of ['view', 'insert', 'analyze', 'collaborate', 'manage']) {
      expectTabWithCommands(result, tabId);
    }
  });

  it('adds contextual Modify only for selections without hiding ordinary tabs', () => {
    const emptySelection = render(<RibbonBar activeMode="plan" />);
    expect(emptySelection.queryByTestId('ribbon-tab-modify')).toBeNull();
    emptySelection.unmount();

    const planSelection = render(<RibbonBar activeMode="plan" selectedElementKind="wall" />);
    expect(planSelection.getByTestId('ribbon-tab-modify').textContent).toBe('Modify | Wall');
    expect(planSelection.getByRole('tab', { name: 'Create' })).toBeTruthy();
    expect(planSelection.getByRole('tab', { name: 'Collaborate' })).toBeTruthy();
    expect(planSelection.getByRole('tab', { name: 'View' })).toBeTruthy();
    expect(planSelection.getByRole('tab', { name: 'Manage' })).toBeTruthy();
    expect(planSelection.getByRole('tab', { name: 'Steel' })).toBeTruthy();
    expectTabWithCommands(planSelection, 'modify');
    planSelection.unmount();

    const modelSelection = render(<RibbonBar activeMode="3d" selectedElementKind="beam" />);
    expect(modelSelection.getByTestId('ribbon-tab-modify').textContent).toBe('Modify | Beam');
    expect(modelSelection.getByRole('tab', { name: 'Model' })).toBeTruthy();
    expect(modelSelection.getByRole('tab', { name: '3D View' })).toBeTruthy();
    expect(modelSelection.getByRole('tab', { name: 'Manage' })).toBeTruthy();
  });

  it('keeps ribbon reachability free of disabled rows in all shipped view schemas', () => {
    for (const mode of ['plan', '3d', 'section', 'sheet', 'schedule'] as const) {
      const disabledRows = ribbonCommandReachabilityForMode(mode).filter(
        (row) => row.behavior === 'disabled',
      );
      expect(disabledRows).toEqual([]);
    }
  });
});
