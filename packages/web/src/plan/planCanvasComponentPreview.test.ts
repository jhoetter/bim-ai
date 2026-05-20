import type { Element } from '@bim-ai/core';
import { describe, expect, it } from 'vitest';

import {
  componentPreviewSymbolKind,
  resolveActiveComponentAsset,
} from './planCanvasComponentPreview';

describe('planCanvasComponentPreview', () => {
  it('prefers store asset entries over preview entries', () => {
    const asset = {
      id: 'asset-1',
      kind: 'asset_library_entry',
      planSymbolKind: 'table',
    } as unknown as Element;

    const resolved = resolveActiveComponentAsset({
      planTool: 'component',
      activeComponentAssetId: 'asset-1',
      elementsById: { 'asset-1': asset },
      previewEntry: { id: 'asset-1', planSymbolKind: 'chair' },
    });

    expect(componentPreviewSymbolKind(resolved)).toBe('table');
  });

  it('falls back to active preview entry when the store entry is absent', () => {
    const resolved = resolveActiveComponentAsset({
      planTool: 'component',
      activeComponentAssetId: 'asset-2',
      elementsById: {},
      previewEntry: { id: 'asset-2', renderProxyKind: 'sofa' },
    });

    expect(componentPreviewSymbolKind(resolved)).toBe('sofa');
  });
});
