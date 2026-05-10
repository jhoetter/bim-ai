import { describe, expect, it } from 'vitest';

import {
  FAMILY_TEMPLATE_BROWSER_ENTRIES,
  buildFamilyTemplateMetadata,
  filterFamilyTemplateBrowserEntries,
  getFamilyTemplateBrowserEntry,
} from './familyTemplateCatalog';

describe('family template catalog', () => {
  it('exposes Revit-style .rft entries with host and category metadata', () => {
    expect(FAMILY_TEMPLATE_BROWSER_ENTRIES.map((entry) => entry.fileName)).toEqual([
      'Metric Generic Model.rft',
      'Metric Door.rft',
      'Metric Window.rft',
      'Metric Profile.rft',
      'Metric Furniture.rft',
    ]);

    expect(getFamilyTemplateBrowserEntry('door')).toMatchObject({
      category: 'door',
      hostType: 'wall_hosted',
    });
    expect(getFamilyTemplateBrowserEntry('furniture')).toMatchObject({
      category: 'furniture',
      hostType: 'standalone',
    });
  });

  it('searches and filters template browser entries', () => {
    expect(
      filterFamilyTemplateBrowserEntries(FAMILY_TEMPLATE_BROWSER_ENTRIES, {
        query: 'furniture',
        hostType: 'all',
        category: 'all',
      }).map((entry) => entry.fileName),
    ).toEqual(['Metric Furniture.rft']);

    expect(
      filterFamilyTemplateBrowserEntries(FAMILY_TEMPLATE_BROWSER_ENTRIES, {
        hostType: 'wall_hosted',
        category: 'all',
      }).map((entry) => entry.id),
    ).toEqual(['door', 'window']);
  });

  it('builds persisted metadata for selected templates', () => {
    const metadata = buildFamilyTemplateMetadata(getFamilyTemplateBrowserEntry('furniture'), {
      originReferencePlaneIds: ['furniture-center-left-right', 'furniture-center-front-back'],
      referencePlaneIds: ['furniture-center-left-right', 'furniture-center-front-back'],
      defaultTypeNames: ['600 x 600 Chair'],
    });

    expect(metadata).toMatchObject({
      templateId: 'furniture',
      fileName: 'Metric Furniture.rft',
      hostType: 'standalone',
      category: 'furniture',
      originReferencePlaneIds: ['furniture-center-left-right', 'furniture-center-front-back'],
      defaultTypeNames: ['600 x 600 Chair'],
    });
  });
});
