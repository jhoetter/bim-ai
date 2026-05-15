import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';

import { listMaterials, resolveMaterial } from '../viewport/materials';
import { AppearanceAssetBrowserDialog } from './AppearanceAssetBrowserDialog';
import { MaterialBrowserDialog } from './MaterialBrowserDialog';

afterEach(() => {
  cleanup();
});

describe('<MaterialBrowserDialog />', () => {
  it('lists material swatches and assigns a selected material key', () => {
    const material = listMaterials()[0]!;
    const onAssign = vi.fn();
    const { getByTestId } = render(<MaterialBrowserDialog onAssign={onAssign} onClose={vi.fn()} />);

    expect(getByTestId(`material-row-${material.key}`)).toBeTruthy();
    fireEvent.click(getByTestId(`material-assign-${material.key}`));
    expect(onAssign).toHaveBeenCalledWith(material.key);
  });

  it('shows the active assignment target', () => {
    const { getByText } = render(
      <MaterialBrowserDialog onAssign={vi.fn()} onClose={vi.fn()} targetLabel="Window · Glass" />,
    );

    expect(getByText('Target: Window · Glass')).toBeTruthy();
  });

  it('filters materials by search text', () => {
    const glass = listMaterials().find((material) => material.category === 'glass')!;
    const timber = listMaterials().find((material) => material.category === 'timber')!;
    const { getByLabelText, getByTestId, queryByText } = render(
      <MaterialBrowserDialog onAssign={vi.fn()} onClose={vi.fn()} />,
    );

    fireEvent.change(getByLabelText('Search materials'), { target: { value: glass.displayName } });
    expect(getByTestId(`material-row-${glass.key}`)).toBeTruthy();
    expect(queryByText(timber.displayName)).toBeNull();
  });

  it('lists project material elements supplied by the current document', () => {
    const material: Extract<Element, { kind: 'material' }> = {
      kind: 'material',
      id: 'mat-project-limewash',
      name: 'Project Limewash',
      category: 'plaster',
      appearance: { baseColor: '#e8dfc8', roughness: 0.94 },
    };
    const onAssign = vi.fn();
    const { getByText, getByTestId } = render(
      <MaterialBrowserDialog
        elementsById={{ [material.id]: material }}
        onAssign={onAssign}
        onClose={vi.fn()}
      />,
    );

    expect(getByText('Project Limewash')).toBeTruthy();
    fireEvent.click(getByTestId(`material-assign-${material.id}`));
    expect(onAssign).toHaveBeenCalledWith(material.id);
  });

  it('creates and renames family/project materials with editable metadata tabs', () => {
    const onAssign = vi.fn();
    const { getByLabelText, getByText, getByTestId } = render(
      <MaterialBrowserDialog onAssign={onAssign} onClose={vi.fn()} />,
    );

    fireEvent.click(getByText('Create material'));
    fireEvent.change(getByLabelText('New material name'), {
      target: { value: 'Dialog Custom Finish 905' },
    });
    fireEvent.change(getByLabelText('New material category'), { target: { value: 'plaster' } });
    fireEvent.click(getByText('Create'));

    const created = listMaterials().find(
      (material) => material.displayName === 'Dialog Custom Finish 905',
    )!;
    expect(created.baseColor).toBeTruthy();
    fireEvent.click(getByTestId(`material-assign-${created.key}`));
    expect(onAssign).toHaveBeenCalledWith(created.key);

    fireEvent.click(getByTestId(`material-rename-${created.key}`));
    fireEvent.change(getByLabelText('Rename Dialog Custom Finish 905'), {
      target: { value: 'Dialog Renamed Finish 905' },
    });
    fireEvent.click(getByText('Save'));
    expect(resolveMaterial(created.key)?.displayName).toBe('Dialog Renamed Finish 905');

    fireEvent.click(getByText('Graphics'));
    fireEvent.change(getByLabelText('Shaded color'), { target: { value: '#445566' } });
    fireEvent.change(getByLabelText('Graphics transparency'), { target: { value: '0.22' } });
    fireEvent.change(getByLabelText('Surface pattern'), { target: { value: 'running-bond' } });
    fireEvent.change(getByLabelText('Cut pattern'), { target: { value: 'masonry-cut' } });
    expect(resolveMaterial(created.key)?.graphics).toMatchObject({
      shadedColor: '#445566',
      transparency: 0.22,
      surfacePattern: 'running-bond',
      cutPattern: 'masonry-cut',
    });

    fireEvent.click(getByText('Appearance'));
    fireEvent.change(getByLabelText('Texture map metadata'), {
      target: { value: 'project/dialog/albedo' },
    });
    fireEvent.change(getByLabelText('UV scale U mm'), { target: { value: '215' } });
    fireEvent.change(getByLabelText('UV scale V mm'), { target: { value: '75' } });
    fireEvent.change(getByLabelText('UV rotation deg'), { target: { value: '90' } });
    expect(resolveMaterial(created.key)).toMatchObject({
      textureMapUrl: 'project/dialog/albedo',
      uvScaleMm: { uMm: 215, vMm: 75 },
      uvRotationDeg: 90,
    });

    fireEvent.click(getByText('Physical'));
    fireEvent.change(getByLabelText('Density kg/m3'), { target: { value: '1440' } });
    expect(resolveMaterial(created.key)?.physical?.densityKgPerM3).toBe(1440);

    fireEvent.click(getByText('Thermal'));
    fireEvent.change(getByLabelText('Conductivity W/mK'), { target: { value: '0.21' } });
    expect(resolveMaterial(created.key)?.thermal?.conductivityWPerMK).toBe(0.21);
  });

  it('duplicates built-in materials into editable project materials with status badges', () => {
    const source = listMaterials().find((material) => material.key === 'masonry_brick')!;
    const { getByTestId } = render(<MaterialBrowserDialog onAssign={vi.fn()} onClose={vi.fn()} />);

    expect(getByTestId(`material-status-${source.key}`).textContent).toBe('Color only');
    fireEvent.click(getByTestId(`material-duplicate-${source.key}`));

    const duplicate = listMaterials().find(
      (material) => material.displayName === `${source.displayName} copy`,
    )!;
    expect(duplicate.source).toBe('project');
    expect(duplicate.baseColor).toBe(source.baseColor);
    expect(resolveMaterial(source.key)?.displayName).toBe(source.displayName);
  });
});

describe('<AppearanceAssetBrowserDialog />', () => {
  it('uses a distinct Replace action for appearance assets', () => {
    const material = listMaterials()[0]!;
    const onReplace = vi.fn();
    const { getByLabelText, getByTestId, getByText } = render(
      <AppearanceAssetBrowserDialog onReplace={onReplace} onClose={vi.fn()} />,
    );

    expect(getByLabelText('Appearance Asset Browser')).toBeTruthy();
    fireEvent.click(getByTestId(`material-assign-${material.key}`));
    expect(onReplace).toHaveBeenCalledWith(material.key);
  });

  it('exposes curated asset metadata and reflectance editing', () => {
    const asset = listMaterials().find((material) => material.key === 'asset_stainless_brushed')!;
    const onReplace = vi.fn();
    const { getByLabelText, getByTestId, getByText } = render(
      <AppearanceAssetBrowserDialog onReplace={onReplace} onClose={vi.fn()} />,
    );

    expect(
      listMaterials().filter((material) => material.source === 'curated_asset').length,
    ).toBeGreaterThan(12);
    fireEvent.click(getByText('Appearance'));
    fireEvent.change(getByLabelText('Search materials'), {
      target: { value: asset.displayName },
    });
    fireEvent.change(getByLabelText('Texture map metadata'), {
      target: { value: 'library/custom/stainless-brushed-color' },
    });
    fireEvent.change(getByLabelText('Bump map metadata'), {
      target: { value: 'library/custom/stainless-brushed-bump' },
    });
    fireEvent.change(getByLabelText('Reflectance'), { target: { value: '0.81' } });

    expect(resolveMaterial(asset.key)).toMatchObject({
      textureMapUrl: 'library/custom/stainless-brushed-color',
      bumpMapUrl: 'library/custom/stainless-brushed-bump',
      reflectance: 0.81,
    });

    fireEvent.click(getByTestId(`material-assign-${asset.key}`));
    expect(onReplace).toHaveBeenCalledWith(asset.key);
  });
});
