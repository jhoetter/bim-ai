import type { PlanProjectionPrimitivesV1Wire } from '../plan/planProjectionWire';

/** Match server `planProjectionPrimitives_v1.roofs[]` entry for a roof element id. */
export function roofPlanWireRowForElement(
  roofId: string,
  primitives: PlanProjectionPrimitivesV1Wire | null,
): Record<string, unknown> | null {
  if (!primitives) return null;
  const roofs = primitives.roofs;
  if (!Array.isArray(roofs)) return null;
  for (const r of roofs) {
    if (r && typeof r === 'object') {
      const raw = r as Record<string, unknown>;
      const id = String(raw.id ?? '');
      if (id === roofId) return raw;
    }
  }
  return null;
}

/** Monospace-friendly diagnostics for Inspector / agents. */
export function roofInspectorWireDiagnosticsLines(row: Record<string, unknown> | null): string[] {
  if (!row) {
    return ['(no plan wire row — open floor plan with a saved plan_view)'];
  }
  const lines: string[] = [];
  const tok = row.roofGeometrySupportToken ?? row.roof_geometry_support_token;
  if (typeof tok === 'string' && tok.trim()) lines.push(`support: ${tok.trim()}`);
  const pr = row.roofPlanGeometryReadout_v0 ?? row.roof_plan_geometry_readout_v0;
  if (typeof pr === 'string' && pr.trim()) lines.push(`planReadout: ${pr.trim()}`);
  const pk = row.proxyKind ?? row.proxy_kind;
  if (typeof pk === 'string' && pk.trim()) lines.push(`proxyKind: ${pk.trim()}`);
  return lines.length ? lines : ['(wire row has no diagnostic tokens)'];
}
