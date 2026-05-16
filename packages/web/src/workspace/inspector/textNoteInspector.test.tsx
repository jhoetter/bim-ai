import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { InspectorPropertiesFor } from './InspectorContent';
import i18n from '../../i18n';

const t = i18n.t.bind(i18n);

afterEach(() => {
  cleanup();
});

const textNote: Extract<Element, { kind: 'text_note' }> = {
  kind: 'text_note',
  id: 'tn-fmt-1',
  hostViewId: 'pv-1',
  positionMm: { xMm: 1000, yMm: 2000 },
  text: 'Format me',
  fontSizeMm: 200,
};

describe('text note inspector formatting — §4.10', () => {
  it('renders inspector-text-bold button', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(textNote, t, { onPropertyChange: onChange }),
    );
    expect(getByTestId('inspector-text-bold')).toBeTruthy();
  });

  it('renders inspector-text-italic button', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(textNote, t, { onPropertyChange: onChange }),
    );
    expect(getByTestId('inspector-text-italic')).toBeTruthy();
  });

  it('renders inspector-text-underline button', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(textNote, t, { onPropertyChange: onChange }),
    );
    expect(getByTestId('inspector-text-underline')).toBeTruthy();
  });

  it('bold button click dispatches update_element_property for bold:true', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(textNote, t, { onPropertyChange: onChange }),
    );
    fireEvent.click(getByTestId('inspector-text-bold'));
    expect(onChange).toHaveBeenCalledWith('bold', true);
  });

  it('renders inspector-text-color input', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(textNote, t, { onPropertyChange: onChange }),
    );
    const colorInput = getByTestId('inspector-text-color') as HTMLInputElement;
    expect(colorInput.type).toBe('color');
  });

  it('renders inspector-text-align-center button', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(textNote, t, { onPropertyChange: onChange }),
    );
    expect(getByTestId('inspector-text-align-center')).toBeTruthy();
  });

  it('align-center button click dispatches horizontalAlign:center', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(textNote, t, { onPropertyChange: onChange }),
    );
    fireEvent.click(getByTestId('inspector-text-align-center'));
    expect(onChange).toHaveBeenCalledWith('horizontalAlign', 'center');
  });

  it('color change dispatches colorHex', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      InspectorPropertiesFor(textNote, t, { onPropertyChange: onChange }),
    );
    const colorInput = getByTestId('inspector-text-color') as HTMLInputElement;
    fireEvent.change(colorInput, { target: { value: '#ff0000' } });
    expect(onChange).toHaveBeenCalledWith('colorHex', '#ff0000');
  });
});
