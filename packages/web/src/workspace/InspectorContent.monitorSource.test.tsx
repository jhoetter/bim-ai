import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

describe('FED-03 — InspectorPropertiesFor monitorSource', () => {
  const link: Extract<Element, { kind: 'link_model' }> = {
    kind: 'link_model',
    id: 'link-str',
    name: 'Structure',
    sourceModelId: '11111111-1111-1111-1111-111111111111',
    positionMm: { xMm: 0, yMm: 0, zMm: 0 },
    rotationDeg: 0,
    originAlignmentMode: 'origin_to_origin',
  };

  it('renders structured monitorSource with link name + element id + revision', () => {
    const grid: Element = {
      kind: 'grid_line',
      id: 'g-host',
      name: 'A',
      label: 'A',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 10000, yMm: 0 },
      monitorSource: {
        linkId: 'link-str',
        elementId: 'g-source',
        sourceRevisionAtCopy: 4,
      },
    };
    const { getByText } = render(
      InspectorPropertiesFor(grid, t, { elementsById: { [link.id]: link } }),
    );
    expect(getByText(/Structure \/ g-source @r4/)).toBeTruthy();
  });

  it('falls back to legacy monitorSourceId when monitorSource is absent', () => {
    const lvl: Element = {
      kind: 'level',
      id: 'lvl-1',
      name: 'Ground',
      elevationMm: 0,
      monitorSourceId: 'old-source',
    };
    const { getByText } = render(InspectorPropertiesFor(lvl, t));
    expect(getByText(/old-source/)).toBeTruthy();
  });

  it('shows drift banner + Accept source / Keep host buttons when drifted', () => {
    const onMonitorReconcile = vi.fn();
    const grid: Element = {
      kind: 'grid_line',
      id: 'g-host',
      name: 'A',
      label: 'A',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 10000, yMm: 0 },
      monitorSource: {
        linkId: 'link-str',
        elementId: 'g-source',
        sourceRevisionAtCopy: 1,
        drifted: true,
        driftedFields: ['end', 'name'],
      },
    };
    const { getByTestId, getByRole } = render(
      InspectorPropertiesFor(grid, t, {
        elementsById: { [link.id]: link },
        onMonitorReconcile,
      }),
    );
    expect(getByTestId('monitor-drift-banner')).toBeTruthy();
    fireEvent.click(getByRole('button', { name: 'Accept source' }));
    expect(onMonitorReconcile).toHaveBeenCalledWith('g-host', 'accept_source');
    fireEvent.click(getByRole('button', { name: 'Keep host' }));
    expect(onMonitorReconcile).toHaveBeenCalledWith('g-host', 'keep_host');
  });

  it('does not show drift banner when monitorSource is clean', () => {
    const grid: Element = {
      kind: 'grid_line',
      id: 'g-host',
      name: 'A',
      label: 'A',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 10000, yMm: 0 },
      monitorSource: {
        linkId: 'link-str',
        elementId: 'g-source',
        sourceRevisionAtCopy: 4,
        drifted: false,
      },
    };
    const { queryByTestId } = render(
      InspectorPropertiesFor(grid, t, { elementsById: { [link.id]: link } }),
    );
    expect(queryByTestId('monitor-drift-banner')).toBeNull();
  });
});
