import { describe, expect, it } from 'vitest';

import { coerceElement } from '../storeCoercion';

describe('asset element coercion', () => {
  it('coerces asset library entries from snake_case input and filters invalid tags', () => {
    const element = coerceElement('asset-sofa', {
      kind: 'asset_library_entry',
      name: 'Sofa',
      assetKind: 'family_instance',
      category: 'casework',
      tags: ['living', 42, 'soft'],
      discipline_tags: ['arch', 'bad', 'mep'],
      thumbnail_kind: 'rendered_3d',
      thumbnail_width_mm: '2200',
      thumbnail_height_mm: 'bad',
      plan_symbol_kind: 'sofa',
      render_proxy_kind: 'not-valid',
      published_from_org_id: 'org-1',
      description: 'Lounge asset',
    });

    expect(element?.kind).toBe('asset_library_entry');
    if (element?.kind !== 'asset_library_entry') return;
    expect(element.assetKind).toBe('family_instance');
    expect(element.category).toBe('casework');
    expect(element.tags).toEqual(['living', 'soft']);
    expect(element.disciplineTags).toEqual(['arch', 'mep']);
    expect(element.thumbnailKind).toBe('schematic_plan');
    expect(element.thumbnailWidthMm).toBe(2200);
    expect(element.thumbnailHeightMm).toBeUndefined();
    expect(element.planSymbolKind).toBe('sofa');
    expect(element.renderProxyKind).toBeUndefined();
    expect(element.publishedFromOrgId).toBe('org-1');
    expect(element.description).toBe('Lounge asset');
  });

  it('coerces placed assets from camelCase input and defaults invalid placement numbers', () => {
    const element = coerceElement('placed-1', {
      kind: 'placed_asset',
      name: 'Placed sofa',
      assetId: 'asset-sofa',
      levelId: 'lvl-1',
      positionMm: { xMm: 'bad', yMm: '1500' },
      rotationDeg: 'bad',
      paramValues: { seats: 3 },
      hostElementId: 'wall-1',
    });

    expect(element?.kind).toBe('placed_asset');
    if (element?.kind !== 'placed_asset') return;
    expect(element.assetId).toBe('asset-sofa');
    expect(element.levelId).toBe('lvl-1');
    expect(element.positionMm).toEqual({ xMm: 0, yMm: 1500 });
    expect(element.rotationDeg).toBe(0);
    expect(element.paramValues).toEqual({ seats: 3 });
    expect(element.hostElementId).toBe('wall-1');
  });

  it('rejects placed assets without required relations', () => {
    expect(coerceElement('missing-asset', { kind: 'placed_asset', level_id: 'lvl-1' })).toBeNull();
    expect(
      coerceElement('missing-level', { kind: 'placed_asset', asset_id: 'asset-1' }),
    ).toBeNull();
  });
});
