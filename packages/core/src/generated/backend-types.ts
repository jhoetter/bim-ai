// ============================================================================
// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Source of truth: app/bim_ai/cmd/*.py (Pydantic models).
// Generator: app/scripts/export_schemas.py (ARCH-CQ-06).
// Regenerate:  cd app && PYTHONPATH=. uv run python scripts/export_schemas.py
//
// CI gate: scripts/check-backend-types-sync.mjs (run by `pnpm verify:strict`)
// regenerates this file and fails the build if the working copy drifts.
// ============================================================================

/**
 * CMD-V3-02 provenance trace linking an element to its originating bundle.
 */
export interface AgentTrace {
  bundleId: string;
  assumptionKeys?: string[];
  appliedAt: string;
}

export interface AssumptionEntry {
  key: string;
  value: string | number | boolean;
  confidence: number;
  source: string;
  contestable?: boolean;
  evidence?: string | null;
}

export interface BundleResult {
  schemaVersion?: string;
  applied: boolean;
  newRevision?: number | null;
  changedIds?: string[];
  optionId?: string | null;
  violations?: Record<string, unknown>[];
  checkpointSnapshotId?: string | null;
}

export interface CommandBundle {
  schemaVersion?: 'cmd-v3.0';
  commands: Record<string, unknown>[];
  assumptions: AssumptionEntry[];
  parentRevision: number;
  targetOptionId?: string | null;
  tolerances?: ToleranceEntry[] | null;
}

export interface ToleranceEntry {
  advisoryClass: string;
  reason: string;
}
