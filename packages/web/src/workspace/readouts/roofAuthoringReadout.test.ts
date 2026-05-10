import { describe, expect, it } from 'vitest';

import type { PlanProjectionPrimitivesV1Wire } from '../../plan/planProjectionWire';
import {
  roofInspectorWireDiagnosticsLines,
  roofPlanWireRowForElement,
} from './roofAuthoringReadout';

describe('roofAuthoringReadout', () => {
  it('finds roof row by id in plan wire primitives', () => {
    const prim = {
      format: 'planProjectionPrimitives_v1',
      roofs: [{ id: 'r1', roofPlanGeometryReadout_v0: 'gable_projection_supported' }],
    } as unknown as PlanProjectionPrimitivesV1Wire;
    const row = roofPlanWireRowForElement('r1', prim);
    expect(row?.roofPlanGeometryReadout_v0).toBe('gable_projection_supported');
    expect(roofPlanWireRowForElement('missing', prim)).toBeNull();
    expect(roofPlanWireRowForElement('r1', null)).toBeNull();
  });

  it('formats diagnostics lines from a wire row', () => {
    const row: Record<string, unknown> = {
      roofGeometrySupportToken: 'valley_candidate_deferred',
      roofPlanGeometryReadout_v0: 'footprint_proxy_deferred',
      proxyKind: 'footprintChord',
    };
    expect(roofInspectorWireDiagnosticsLines(row)).toEqual([
      'support: valley_candidate_deferred',
      'planReadout: footprint_proxy_deferred',
      'proxyKind: footprintChord',
    ]);
  });

  it('returns placeholder when wire row is absent', () => {
    const lines = roofInspectorWireDiagnosticsLines(null);
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('no plan wire row');
  });
});
