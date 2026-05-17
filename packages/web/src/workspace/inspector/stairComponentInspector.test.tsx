import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const stairRun: Extract<Element, { kind: 'stair_run' }> = {
  kind: 'stair_run',
  id: 'run-1',
  stairId: 'stair-1',
  startMm: { xMm: 0, yMm: 0 },
  endMm: { xMm: 3000, yMm: 0 },
  runWidthMm: 1200,
  riserCount: 10,
  runIndex: 0,
};

const stairLanding: Extract<Element, { kind: 'stair_landing' }> = {
  kind: 'stair_landing',
  id: 'landing-1',
  stairId: 'stair-1',
  perimeterMm: [
    { xMm: 0, yMm: 0 },
    { xMm: 1200, yMm: 0 },
    { xMm: 1200, yMm: 1200 },
    { xMm: 0, yMm: 1200 },
  ],
  elevationMm: 1800,
  landingIndex: 0,
};

describe('stair_run inspector — §8.6.2', () => {
  it('renders run width input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stairRun, t));
    expect(getByTestId('inspector-stair-run-width')).toBeTruthy();
  });

  it('renders riser count input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stairRun, t));
    expect(getByTestId('inspector-stair-run-risers')).toBeTruthy();
  });

  it('run index label is shown', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stairRun, t));
    const span = getByTestId('inspector-stair-run-index');
    expect(span.textContent).toBe('Run 1');
  });

  it('calls onPropertyChange with runWidthMm when run width changes', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(stairRun, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-stair-run-width') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1500' } });
    expect(onChange).toHaveBeenCalledWith('runWidthMm', 1500);
  });

  it('calls onPropertyChange with riserCount when riser count changes', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(stairRun, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-stair-run-risers') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12' } });
    expect(onChange).toHaveBeenCalledWith('riserCount', 12);
  });
});

describe('stair_landing inspector — §8.6.2', () => {
  it('renders elevation input', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stairLanding, t));
    expect(getByTestId('inspector-stair-landing-elevation')).toBeTruthy();
  });

  it('renders boundary points count', () => {
    const { getByTestId } = render(InspectorPropertiesFor(stairLanding, t));
    const span = getByTestId('inspector-stair-landing-points');
    expect(span.textContent).toBe('4 boundary points');
  });

  it('calls onPropertyChange with elevationMm when elevation changes', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(stairLanding, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-stair-landing-elevation') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2400' } });
    expect(onChange).toHaveBeenCalledWith('elevationMm', 2400);
  });
});
