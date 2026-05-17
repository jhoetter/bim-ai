import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

function makeDecal(
  overrides: Partial<Extract<Element, { kind: 'decal' }>> = {},
): Extract<Element, { kind: 'decal' }> {
  return {
    kind: 'decal',
    id: 'decal-1',
    parentElementId: 'wall-1',
    parentSurface: 'front',
    imageAssetId: '',
    uvRect: { u0: 0, v0: 0, u1: 1, v1: 1 },
    ...overrides,
  };
}

describe('decal inspector — §8.1.5', () => {
  it('renders inspector-decal section', () => {
    const onChange = vi.fn();
    const decal = makeDecal();
    const { getByTestId } = render(
      InspectorPropertiesFor(decal, t, { onPropertyChange: onChange }),
    );
    expect(getByTestId('inspector-decal')).toBeTruthy();
  });

  it('shows no-image placeholder when imageSrc is null', () => {
    const onChange = vi.fn();
    const decal = makeDecal({ imageSrc: null });
    const { getByTestId, queryByTestId } = render(
      InspectorPropertiesFor(decal, t, { onPropertyChange: onChange }),
    );
    expect(getByTestId('inspector-decal-no-image')).toBeTruthy();
    expect(queryByTestId('inspector-decal-preview')).toBeNull();
  });

  it('shows image preview when imageSrc is set', () => {
    const onChange = vi.fn();
    const decal = makeDecal({ imageSrc: 'data:image/png;base64,abc' });
    const { getByTestId, queryByTestId } = render(
      InspectorPropertiesFor(decal, t, { onPropertyChange: onChange }),
    );
    const preview = getByTestId('inspector-decal-preview') as HTMLImageElement;
    expect(preview).toBeTruthy();
    expect(preview.src).toContain('data:image/png;base64,abc');
    expect(queryByTestId('inspector-decal-no-image')).toBeNull();
  });

  it('renders file input with accept=image/*', () => {
    const onChange = vi.fn();
    const decal = makeDecal();
    const { getByTestId } = render(
      InspectorPropertiesFor(decal, t, { onPropertyChange: onChange }),
    );
    const input = getByTestId('inspector-decal-file-input') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('file');
    expect(input.accept).toBe('image/*');
  });

  it('renders width and height inputs', () => {
    const onChange = vi.fn();
    const decal = makeDecal({ widthMm: 800, heightMm: 600 });
    const { getByTestId } = render(
      InspectorPropertiesFor(decal, t, { onPropertyChange: onChange }),
    );
    const widthInput = getByTestId('inspector-decal-width') as HTMLInputElement;
    const heightInput = getByTestId('inspector-decal-height') as HTMLInputElement;
    expect(widthInput).toBeTruthy();
    expect(widthInput.type).toBe('number');
    expect(Number(widthInput.value)).toBe(800);
    expect(heightInput).toBeTruthy();
    expect(heightInput.type).toBe('number');
    expect(Number(heightInput.value)).toBe(600);
  });

  it('renders opacity slider', () => {
    const onChange = vi.fn();
    const decal = makeDecal({ opacity: 0.75 });
    const { getByTestId } = render(
      InspectorPropertiesFor(decal, t, { onPropertyChange: onChange }),
    );
    const slider = getByTestId('inspector-decal-opacity') as HTMLInputElement;
    expect(slider).toBeTruthy();
    expect(slider.type).toBe('range');
    expect(Number(slider.min)).toBe(0);
    expect(Number(slider.max)).toBe(1);
    expect(Number(slider.value)).toBeCloseTo(0.75);
  });
});
