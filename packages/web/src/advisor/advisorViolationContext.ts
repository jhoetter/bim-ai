import type { TFunction } from 'i18next';
import type { Violation } from '@bim-ai/core';

const RECOMMENDED_CONTEXT_BY_RULE_ID: Record<string, string> = {
  physical_hard_clash:
    'Recommended: 3D coordination / clash view - inspect intersecting elementIds and move, trim, or route one element clear.',
  furniture_wall_hard_clash:
    'Recommended: Furniture layout / wall coordination - move fixture or furniture clear of the wall, or verify it is intentionally embedded.',
  stair_wall_hard_clash:
    'Recommended: Stair layout / wall coordination - revise stair run, landing, or wall position so required stair geometry is unobstructed.',
  constructability_proxy_unsupported:
    'Recommended: Constructability model setup - replace unsupported proxy geometry with a typed wall, stair, beam, column, pipe, duct, door, or opening.',
  wall_load_bearing_unknown_primary_envelope:
    'Recommended: Wall properties / structural review - set load-bearing status for primary exterior envelope walls.',
  large_opening_in_load_bearing_wall_unresolved:
    'Recommended: Structural openings - add lintel/header/support metadata or engineering approval for the large opening in the load-bearing wall.',
  beam_without_support:
    'Recommended: Structural framing - add or align supporting wall, column, bearing element, or endpoint support for the beam.',
  column_without_foundation_or_support:
    'Recommended: Structural load path - add a foundation, lower column, slab, or bearing support under the column.',
  door_operation_clearance_conflict:
    'Recommended: Door clearance / operations - adjust swing, opening side, nearby elements, or door placement to keep the operation zone clear.',
  pipe_wall_penetration_without_opening:
    'Recommended: MEP coordination - add a sleeve/opening or reroute the pipe where it penetrates the wall.',
  duct_wall_penetration_without_opening:
    'Recommended: MEP coordination - add a sleeve/opening or reroute the duct where it penetrates the wall.',
};

const READABLE_TITLE_BY_RULE_ID: Record<string, string> = {
  physical_hard_clash: 'Physical Hard Clash',
  furniture_wall_hard_clash: 'Furniture Wall Hard Clash',
  stair_wall_hard_clash: 'Stair Wall Hard Clash',
  constructability_proxy_unsupported: 'Unsupported Constructability Proxy',
  wall_load_bearing_unknown_primary_envelope: 'Primary Envelope Wall Missing Load-Bearing Status',
  large_opening_in_load_bearing_wall_unresolved: 'Large Opening In Load-Bearing Wall Unresolved',
  beam_without_support: 'Beam Without Support',
  column_without_foundation_or_support: 'Column Without Foundation Or Support',
  door_operation_clearance_conflict: 'Door Operation Clearance Conflict',
  pipe_wall_penetration_without_opening: 'Pipe Wall Penetration Without Opening',
  duct_wall_penetration_without_opening: 'Duct Wall Penetration Without Opening',
};

/** Human-oriented hint for where to look in the authoring UI (no new server fields). */
export function recommendedContextForRuleId(ruleId: string): string {
  const constructabilityContext = RECOMMENDED_CONTEXT_BY_RULE_ID[ruleId];
  if (constructabilityContext) return constructabilityContext;

  switch (ruleId) {
    case 'schedule_sheet_viewport_missing':
      return 'Recommended: open the linked sheet, add or fix a schedule viewport (viewRef schedule:…).';
    case 'schedule_orphan_sheet_ref':
      return 'Recommended: Schedules — set or clear sheetId so the schedule references a real sheet.';
    case 'schedule_opening_identifier_missing':
      return 'Recommended: Schedules / properties — set door or window mark/name used on opening schedules.';
    case 'schedule_opening_orphan_host':
      return 'Recommended: Restore or re-host the opening onto a valid wall (wallId) so schedule rows resolve.';
    case 'schedule_opening_family_type_incomplete':
      return 'Recommended: Assign familyTypeId on the opening (type columns and type-driven schedules).';
    case 'schedule_opening_host_wall_type_incomplete':
      return 'Recommended: Assign wallTypeId on the host wall (hostWallTypeId / hostWallTypeDisplay columns).';
    case 'schedule_sheet_export_parity_csv_diverges':
    case 'schedule_sheet_export_parity_json_diverges':
    case 'schedule_sheet_export_parity_listing_diverges':
      return 'Recommended: Schedules — re-derive the schedule table; CSV / JSON / sheet listing row counts disagree.';
    case 'sheet_missing_titleblock':
      return 'Recommended: Sheet authoring — set title block symbol on this sheet.';
    case 'sheet_viewport_zero_extent':
      return 'Recommended: Sheet viewports — restore positive widthMm/heightMm for the listed viewport(s).';
    case 'sheet_viewport_unknown_ref':
      return 'Recommended: Sheet viewports — fix or remove the unresolved viewRef.';
    case 'room_finish_metadata_hint':
      return 'Recommended: Room Inspector — finishSet for documentation schedules.';
    case 'room_programme_metadata_hint':
      return 'Recommended: Room Inspector — programmeCode / department for correlation.';
    case 'room_target_area_mismatch':
      return 'Recommended: Room outline vs target area — adjust boundary or targetAreaM2.';
    case 'level_datum_parent_cycle':
    case 'level_datum_parent_offset_mismatch':
    case 'wall_constraint_levels_inverted':
    case 'level_parent_unresolved':
    case 'datum_grid_reference_missing':
    case 'elevation_marker_view_unresolved':
    case 'section_level_reference_missing':
      return 'Recommended: Levels datum chain / wall level constraints.';
    case 'exchange_ifc_roundtrip_count_mismatch':
    case 'exchange_ifc_roundtrip_programme_mismatch':
    case 'exchange_ifc_ids_identity_pset_gap':
    case 'exchange_ifc_ids_qto_gap':
    case 'exchange_ifc_unhandled_geometry_present':
    case 'exchange_ifc_kernel_geometry_skip_summary':
    case 'exchange_manifest_ifc_gltf_slice_mismatch':
    case 'exchange_ifc_manifest_authoritative_alignment_drift':
    case 'exchange_ifc_manifest_unsupported_alignment_drift':
    case 'exchange_ifc_manifest_ids_pointer_alignment_drift':
      return 'Recommended: OpenBIF / IDS export evidence — inspect IFC manifest and advisories.';
    default:
      return 'Inspect related elements and Advisor message; use perspective filter to narrow discipline.';
  }
}

/** Translated version of `recommendedContextForRuleId` — uses i18n when available, falls back to English. */
export function translatedContextForRuleId(ruleId: string, t: TFunction): string {
  return t(`violation.ctx.${ruleId}`, {
    defaultValue: t('violation.ctx._default', {
      defaultValue: recommendedContextForRuleId(ruleId),
    }),
  });
}

/** Snake_case ruleId → readable title fallback when no i18n key is defined. */
export function humanizeRuleId(ruleId: string): string {
  const readableTitle = READABLE_TITLE_BY_RULE_ID[ruleId];
  if (readableTitle) return readableTitle;

  return ruleId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstViewRefFromViewports(cmd: Record<string, unknown>): string | null {
  const rows = cmd.viewportsMm;
  if (!Array.isArray(rows) || !rows.length) return null;
  const first = rows[0];
  if (!first || typeof first !== 'object') return null;
  const vr =
    (first as Record<string, unknown>).viewRef ?? (first as Record<string, unknown>).view_ref;
  return typeof vr === 'string' && vr.trim() ? vr.trim() : null;
}

/** One or two short monospace-friendly lines describing a pending quick-fix command. */
export function summarizeQuickFixCommand(cmd: Record<string, unknown>): string[] {
  const t = typeof cmd.type === 'string' ? cmd.type : '?';
  const lines: string[] = [`type: ${t}`];

  if (typeof cmd.sheetId === 'string' && cmd.sheetId.trim()) {
    lines.push(`sheetId: ${cmd.sheetId.trim()}`);
  }
  if (typeof cmd.elementId === 'string' && cmd.elementId.trim()) {
    lines.push(`elementId: ${cmd.elementId.trim()}`);
  }
  if (typeof cmd.scheduleId === 'string' && cmd.scheduleId.trim()) {
    lines.push(`scheduleId: ${cmd.scheduleId.trim()}`);
  }
  if (typeof cmd.key === 'string' && cmd.key.trim()) {
    const key = cmd.key.trim();
    const val = cmd.value;
    const valStr =
      val === undefined || val === null
        ? ''
        : typeof val === 'string'
          ? JSON.stringify(val)
          : String(val);
    lines.push(valStr ? `property: ${key} → ${valStr}` : `property: ${key}`);
  }

  const vr = firstViewRefFromViewports(cmd);
  if (vr) {
    lines.push(`first viewport viewRef: ${vr}`);
  }

  return lines.slice(0, 4);
}

const SEVERITY_RANK: Record<Violation['severity'], number> = {
  error: 0,
  warning: 1,
  info: 2,
};

export function sortViolationsDeterministic(violations: Violation[]): Violation[] {
  return [...violations].sort((a, b) => {
    const ra = SEVERITY_RANK[a.severity] ?? 99;
    const rb = SEVERITY_RANK[b.severity] ?? 99;
    if (ra !== rb) return ra - rb;
    const idCmp = a.ruleId.localeCompare(b.ruleId);
    if (idCmp !== 0) return idCmp;
    return a.message.localeCompare(b.message);
  });
}

export function groupViolationsBySeverity(
  sorted: Violation[],
): { severity: Violation['severity']; items: Violation[] }[] {
  const order: Violation['severity'][] = ['error', 'warning', 'info'];
  const buckets = new Map<Violation['severity'], Violation[]>();
  for (const sev of order) buckets.set(sev, []);
  for (const v of sorted) {
    const list = buckets.get(v.severity);
    if (list) list.push(v);
    else buckets.set(v.severity, [v]);
  }
  return order.flatMap((sev) => {
    const items = buckets.get(sev) ?? [];
    return items.length ? [{ severity: sev, items }] : [];
  });
}
