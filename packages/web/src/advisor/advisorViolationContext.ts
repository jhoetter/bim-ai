import type { Violation } from '@bim-ai/core';

/** Human-oriented hint for where to look in the authoring UI (no new server fields). */
export function recommendedContextForRuleId(ruleId: string): string {
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

function firstViewRefFromViewports(cmd: Record<string, unknown>): string | null {
  const rows = cmd.viewportsMm;
  if (!Array.isArray(rows) || !rows.length) return null;
  const first = rows[0];
  if (!first || typeof first !== 'object') return null;
  const vr = (first as Record<string, unknown>).viewRef ?? (first as Record<string, unknown>).view_ref;
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

export function groupViolationsBySeverity(sorted: Violation[]): { severity: Violation['severity']; items: Violation[] }[] {
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
