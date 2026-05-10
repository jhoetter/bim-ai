import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

describe('InspectorPropertiesFor — workset / collaboration fields', () => {
  it('wall workset row', () => {
    const el: Element = {
      kind: 'wall',
      id: 'w-1',
      name: 'Wall 1',
      levelId: 'lvl-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 5000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
      worksetId: 'WS-1',
    };
    const { getByText } = render(InspectorPropertiesFor(el, t));
    expect(getByText('Workset')).toBeTruthy();
    expect(getByText('WS-1')).toBeTruthy();
  });

  it('level monitorSource row', () => {
    const el: Element = {
      kind: 'level',
      id: 'lvl-1',
      name: 'Ground Floor',
      elevationMm: 0,
      monitorSourceId: 'linked-L1',
    };
    const { getByText } = render(InspectorPropertiesFor(el, t));
    expect(getByText('Monitor Source')).toBeTruthy();
    expect(getByText('linked-L1')).toBeTruthy();
  });

  it('grid_line case renders name', () => {
    const el: Element = {
      kind: 'grid_line',
      id: 'gl-1',
      name: 'Grid A',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 10000, yMm: 0 },
      label: 'A',
    };
    const { getByText } = render(InspectorPropertiesFor(el, t));
    expect(getByText('Grid A')).toBeTruthy();
  });

  it('project_settings startingView row', () => {
    const el: Element = {
      kind: 'project_settings',
      id: 'ps-1',
      startingViewId: 'view-1',
    };
    const { getByText } = render(InspectorPropertiesFor(el, t));
    expect(getByText('Starting View')).toBeTruthy();
  });
});
