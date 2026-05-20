import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

function makeProjectBasePoint(
  overrides: Partial<Extract<Element, { kind: 'project_base_point' }>> = {},
): Extract<Element, { kind: 'project_base_point' }> {
  return {
    kind: 'project_base_point',
    id: 'pbp-1',
    positionMm: { xMm: 1000, yMm: 2000, zMm: 300 },
    ...overrides,
  } as Extract<Element, { kind: 'project_base_point' }>;
}

describe('project_base_point inspector', () => {
  it('renders editable coordinate rows', () => {
    const { getByTestId } = render(InspectorPropertiesFor(makeProjectBasePoint(), t));
    expect((getByTestId('inspector-pbp-x') as HTMLInputElement).value).toBe('1000');
    expect((getByTestId('inspector-pbp-y') as HTMLInputElement).value).toBe('2000');
    expect((getByTestId('inspector-pbp-elevation') as HTMLInputElement).value).toBe('300');
  });

  it('commits position changes on blur', () => {
    const onPropertyChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(makeProjectBasePoint(), t, { onPropertyChange }),
    );

    fireEvent.blur(getByTestId('inspector-pbp-x'), { target: { value: '1500' } });

    expect(onPropertyChange).toHaveBeenCalledWith('positionMm', {
      xMm: 1500,
      yMm: 2000,
      zMm: 300,
    });
  });
});
