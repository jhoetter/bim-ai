import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

import { resolveMaterial } from '../viewport/materials';
import { MaterialPreview, previewModeForMaterial } from './MaterialPreview';

describe('<MaterialPreview />', () => {
  it('selects preview modes by material category', () => {
    expect(previewModeForMaterial(resolveMaterial('masonry_brick')!)).toBe('brick-panel');
    expect(previewModeForMaterial(resolveMaterial('glass_clear')!)).toBe('glass-sphere');
    expect(previewModeForMaterial(resolveMaterial('asset_stainless_brushed')!)).toBe(
      'metal-sphere',
    );
    expect(previewModeForMaterial(resolveMaterial('concrete_smooth')!)).toBe('concrete-slab');
  });

  it('renders static preview thumbnails with relief markers in test environments', () => {
    const material = resolveMaterial('asset_brick_running_red')!;
    const { getByTestId } = render(<MaterialPreview material={material} />);

    expect(getByTestId(`material-preview-${material.key}`).dataset.previewMode).toBe('brick-panel');
    expect(getByTestId(`material-preview-relief-${material.key}`)).toBeTruthy();
  });
});
