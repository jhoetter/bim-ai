import { describe, expect, it } from 'vitest';

import { coerceElement } from '../storeCoercion';

describe('link element coercion', () => {
  it('coerces model link camelCase input with revision and visibility metadata', () => {
    const element = coerceElement('link-1', {
      kind: 'link_model',
      name: 'Tower B',
      sourceModelId: 'model-b',
      sourceModelRevision: '7',
      positionMm: { xMm: '100', yMm: 200, zMm: '300' },
      rotationDeg: '15',
      originAlignmentMode: 'shared_coords',
      visibilityMode: 'linked_view',
      hidden: true,
      pinned: true,
    });

    expect(element?.kind).toBe('link_model');
    if (element?.kind !== 'link_model') return;
    expect(element.sourceModelId).toBe('model-b');
    expect(element.sourceModelRevision).toBe(7);
    expect(element.positionMm).toEqual({ xMm: 100, yMm: 200, zMm: 300 });
    expect(element.rotationDeg).toBe(15);
    expect(element.originAlignmentMode).toBe('shared_coords');
    expect(element.visibilityMode).toBe('linked_view');
    expect(element.hidden).toBe(true);
    expect(element.pinned).toBe(true);
  });

  it('rejects incomplete model links and defaults invalid numeric fields', () => {
    expect(coerceElement('missing-source', { kind: 'link_model' })).toBeNull();

    const element = coerceElement('link-2', {
      kind: 'link_model',
      source_model_id: 'model-c',
      source_model_revision: 'not-a-number',
      position_mm: { x_mm: 'bad', y_mm: '20', z_mm: null },
      rotation_deg: 'bad',
      origin_alignment_mode: 'bogus',
      visibility_mode: 'bogus',
    });

    expect(element?.kind).toBe('link_model');
    if (element?.kind !== 'link_model') return;
    expect(element.name).toBe('link-2');
    expect(element.sourceModelRevision).toBeUndefined();
    expect(element.positionMm).toEqual({ xMm: 0, yMm: 20, zMm: 0 });
    expect(element.rotationDeg).toBe(0);
    expect(element.originAlignmentMode).toBe('origin_to_origin');
    expect(element.visibilityMode).toBe('host_view');
  });

  it('coerces DXF link snake_case input with layer visibility and display defaults', () => {
    const element = coerceElement('dxf-1', {
      kind: 'link_dxf',
      name: 'Survey',
      level_id: 'lvl-1',
      origin_mm: { x_mm: 12, y_mm: 'bad' },
      origin_alignment_mode: 'project_origin',
      unit_override: 'feet',
      unit_scale_to_mm: '304.8',
      rotation_deg: '30',
      scale_factor: '2',
      linework: [{ kind: 'line' }],
      dxf_layers: [{ name: 'A-WALL' }],
      hidden_layer_names: ['A-ANNO', 42],
      color_mode: 'native',
      custom_color: '#ff00aa',
      overlay_opacity: '0.45',
      source_path: '/survey/site.dxf',
      loaded: false,
      pinned: true,
    });

    expect(element?.kind).toBe('link_dxf');
    if (element?.kind !== 'link_dxf') return;
    expect(element.levelId).toBe('lvl-1');
    expect(element.originMm).toEqual({ xMm: 12, yMm: 0 });
    expect(element.originAlignmentMode).toBe('project_origin');
    expect(element.unitOverride).toBe('feet');
    expect(element.unitScaleToMm).toBe(304.8);
    expect(element.rotationDeg).toBe(30);
    expect(element.scaleFactor).toBe(2);
    expect(element.linework).toHaveLength(1);
    expect(element.dxfLayers).toHaveLength(1);
    expect(element.hiddenLayerNames).toEqual(['A-ANNO', '42']);
    expect(element.colorMode).toBe('native');
    expect(element.customColor).toBe('#ff00aa');
    expect(element.overlayOpacity).toBe(0.45);
    expect(element.sourcePath).toBe('/survey/site.dxf');
    expect(element.loaded).toBe(false);
    expect(element.pinned).toBe(true);
  });

  it('rejects incomplete DXF links and drops invalid optional numbers', () => {
    expect(coerceElement('dxf-missing-level', { kind: 'link_dxf' })).toBeNull();

    const element = coerceElement('dxf-2', {
      kind: 'link_dxf',
      levelId: 'lvl-2',
      unitScaleToMm: 'bad',
      rotationDeg: 'bad',
      scaleFactor: 'bad',
      overlayOpacity: 'bad',
      hiddenLayerNames: 'A-WALL',
      colorMode: 'not-valid',
    });

    expect(element?.kind).toBe('link_dxf');
    if (element?.kind !== 'link_dxf') return;
    expect(element.originMm).toEqual({ xMm: 0, yMm: 0 });
    expect(element.unitScaleToMm).toBeUndefined();
    expect(element.rotationDeg).toBe(0);
    expect(element.scaleFactor).toBe(1);
    expect(element.overlayOpacity).toBeUndefined();
    expect(element.hiddenLayerNames).toEqual([]);
    expect(element.colorMode).toBe('black_white');
    expect(element.loaded).toBe(true);
  });

  it('coerces external link snake_case input and metadata', () => {
    const element = coerceElement('pdf-1', {
      kind: 'link_external',
      external_link_type: 'pdf',
      source_path: '/underlays/permit.pdf',
      source_name: 'permit.pdf',
      source_metadata: { sizeBytes: 42 },
      reload_status: 'ok',
      last_reload_message: 'Reloaded',
      loaded: false,
      hidden: true,
      pinned: true,
      origin_mm: { x_mm: '10', y_mm: '20' },
      origin_alignment_mode: 'shared_coords',
      rotation_deg: '12',
      scale_factor: '0.5',
      overlay_opacity: '0.35',
    });

    expect(element?.kind).toBe('link_external');
    if (element?.kind !== 'link_external') return;
    expect(element.name).toBe('pdf-1');
    expect(element.externalLinkType).toBe('pdf');
    expect(element.sourcePath).toBe('/underlays/permit.pdf');
    expect(element.sourceName).toBe('permit.pdf');
    expect(element.sourceMetadata).toEqual({ sizeBytes: 42 });
    expect(element.reloadStatus).toBe('ok');
    expect(element.lastReloadMessage).toBe('Reloaded');
    expect(element.loaded).toBe(false);
    expect(element.hidden).toBe(true);
    expect(element.pinned).toBe(true);
    expect(element.originMm).toEqual({ xMm: 10, yMm: 20 });
    expect(element.originAlignmentMode).toBe('shared_coords');
    expect(element.rotationDeg).toBe(12);
    expect(element.scaleFactor).toBe(0.5);
    expect(element.overlayOpacity).toBe(0.35);
  });

  it('rejects incomplete external links and defaults invalid optional metadata', () => {
    expect(coerceElement('external-missing-source', { kind: 'link_external' })).toBeNull();

    const element = coerceElement('external-1', {
      kind: 'link_external',
      sourcePath: '/models/site.ifc',
      externalLinkType: 'bad',
      reloadStatus: 'bad',
      sourceMetadata: 'bad',
      rotationDeg: 'bad',
      scaleFactor: 'bad',
      overlayOpacity: 'bad',
      originAlignmentMode: 'bad',
    });

    expect(element?.kind).toBe('link_external');
    if (element?.kind !== 'link_external') return;
    expect(element.name).toBe('external-1');
    expect(element.externalLinkType).toBe('ifc');
    expect(element.reloadStatus).toBe('not_reloaded');
    expect(element.sourceMetadata).toBeUndefined();
    expect(element.rotationDeg).toBe(0);
    expect(element.scaleFactor).toBe(1);
    expect(element.overlayOpacity).toBeUndefined();
    expect(element.originAlignmentMode).toBe('origin_to_origin');
  });
});
