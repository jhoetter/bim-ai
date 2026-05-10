import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { listMaterials } from '../viewport/materials';
import { AppearanceAssetBrowserDialog } from './AppearanceAssetBrowserDialog';
import { MaterialBrowserDialog } from './MaterialBrowserDialog';

afterEach(() => {
  cleanup();
});

describe('<MaterialBrowserDialog />', () => {
  it('lists material swatches and assigns a selected material key', () => {
    const material = listMaterials()[0]!;
    const onAssign = vi.fn();
    const { getByText, getByTestId } = render(
      <MaterialBrowserDialog onAssign={onAssign} onClose={vi.fn()} />,
    );

    expect(getByText(material.displayName)).toBeTruthy();
    fireEvent.click(getByTestId(`material-assign-${material.key}`));
    expect(onAssign).toHaveBeenCalledWith(material.key);
  });

  it('filters materials by search text', () => {
    const glass = listMaterials().find((material) => material.category === 'glass')!;
    const timber = listMaterials().find((material) => material.category === 'timber')!;
    const { getByLabelText, getByText, queryByText } = render(
      <MaterialBrowserDialog onAssign={vi.fn()} onClose={vi.fn()} />,
    );

    fireEvent.change(getByLabelText('Search materials'), { target: { value: glass.displayName } });
    expect(getByText(glass.displayName)).toBeTruthy();
    expect(queryByText(timber.displayName)).toBeNull();
  });
});

describe('<AppearanceAssetBrowserDialog />', () => {
  it('uses a distinct Replace action for appearance assets', () => {
    const material = listMaterials()[0]!;
    const onReplace = vi.fn();
    const { getByLabelText, getByTestId } = render(
      <AppearanceAssetBrowserDialog onReplace={onReplace} onClose={vi.fn()} />,
    );

    expect(getByLabelText('Appearance Asset Browser')).toBeTruthy();
    fireEvent.click(getByTestId(`material-assign-${material.key}`));
    expect(onReplace).toHaveBeenCalledWith(material.key);
  });
});
