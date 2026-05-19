export type DiagnosticWorkKind =
  | 'advisor'
  | 'renderer-diagnostics'
  | 'diagnostic-overlay'
  | 'evidence-capture';

export type DiagnosticBudgetState = 'in_budget' | 'deferred' | 'stale' | 'over_budget';

export type DiagnosticDegradationLevel = 'none' | 'throttled' | 'deferred' | 'suspended';

export type DiagnosticRunMode =
  | 'idle'
  | 'debounced'
  | 'defer_until_idle'
  | 'manual_only'
  | 'render_stale';

export type DiagnosticSchedulingReasonCode =
  | 'ordinary_model_idle_background'
  | 'model_budget_deferred_throttled'
  | 'model_budget_stale_throttled'
  | 'model_over_budget_auto_diagnostics_suspended'
  | 'diagnostic_volume_throttled'
  | 'diagnostic_volume_over_budget_suspended'
  | 'pointer_interaction_active'
  | 'camera_interaction_active'
  | 'selection_interaction_active'
  | 'recent_input_grace_period'
  | 'page_hidden_suspended';

export type DiagnosticInteractionState = {
  pointerActive?: boolean;
  cameraActive?: boolean;
  selectionActive?: boolean;
  msSinceLastInput?: number | null;
  pageVisible?: boolean;
};

export type DiagnosticModelLoadState = {
  elementCount?: number | null;
  visibleElementCount?: number | null;
  diagnosticCount?: number | null;
  budgetState?: DiagnosticBudgetState | null;
};

export type DiagnosticUiSchedulingPolicyInput = {
  interaction?: DiagnosticInteractionState;
  model?: DiagnosticModelLoadState;
};

export type DiagnosticWorkPlan = {
  kind: DiagnosticWorkKind;
  runMode: DiagnosticRunMode;
  minDelayMs: number;
  throttleMs: number;
  maxWorkSliceMs: number;
  maxItemsPerBatch: number;
  staleResultTtlMs: number;
  reasonCodes: DiagnosticSchedulingReasonCode[];
};

export type DiagnosticUiInputProtection = {
  maxSynchronousDiagnosticMs: 0;
  overlayPointerEvents: 'none';
  preservePointerEvents: true;
  preserveCameraControls: true;
  preserveSelection: true;
};

export type DiagnosticOverlayPolicy = {
  pointerEvents: 'none';
  maxRows: number;
  maxMarkers: number;
  allowStaleDuringInteraction: true;
};

export type DiagnosticUiSchedulingPolicy = {
  format: 'diagnosticUiSchedulingPolicy_v1';
  degradationLevel: DiagnosticDegradationLevel;
  inputProtection: DiagnosticUiInputProtection;
  overlay: DiagnosticOverlayPolicy;
  workPlans: Record<DiagnosticWorkKind, DiagnosticWorkPlan>;
  reasonCodes: DiagnosticSchedulingReasonCode[];
};

export const DIAGNOSTIC_INTERACTION_IDLE_GRACE_MS = 120;
export const DIAGNOSTIC_ORDINARY_MODEL_ELEMENT_LIMIT = 8000;
export const DIAGNOSTIC_OVER_BUDGET_MODEL_ELEMENT_LIMIT = 16000;
export const DIAGNOSTIC_VOLUME_THROTTLE_LIMIT = 250;
export const DIAGNOSTIC_VOLUME_SUSPEND_LIMIT = 1000;

const WORK_KINDS: readonly DiagnosticWorkKind[] = [
  'advisor',
  'renderer-diagnostics',
  'diagnostic-overlay',
  'evidence-capture',
];

const INPUT_PROTECTION: DiagnosticUiInputProtection = {
  maxSynchronousDiagnosticMs: 0,
  overlayPointerEvents: 'none',
  preservePointerEvents: true,
  preserveCameraControls: true,
  preserveSelection: true,
};

export function buildDiagnosticUiSchedulingPolicy(
  input: DiagnosticUiSchedulingPolicyInput = {},
): DiagnosticUiSchedulingPolicy {
  const reasonCodes = uniqueReasons([
    ...interactionReasons(input.interaction),
    ...modelLoadReasons(input.model),
  ]);

  const degradationLevel = pickDegradationLevel(reasonCodes);
  const overlay = buildOverlayPolicy(degradationLevel);
  const workPlans = Object.fromEntries(
    WORK_KINDS.map((kind) => [
      kind,
      buildWorkPlan({
        kind,
        degradationLevel,
        reasonCodes,
      }),
    ]),
  ) as Record<DiagnosticWorkKind, DiagnosticWorkPlan>;

  return {
    format: 'diagnosticUiSchedulingPolicy_v1',
    degradationLevel,
    inputProtection: INPUT_PROTECTION,
    overlay,
    workPlans,
    reasonCodes,
  };
}

export function diagnosticPolicyPreservesInteraction(
  policy: DiagnosticUiSchedulingPolicy,
): boolean {
  return (
    policy.inputProtection.maxSynchronousDiagnosticMs === 0 &&
    policy.inputProtection.overlayPointerEvents === 'none' &&
    policy.inputProtection.preservePointerEvents &&
    policy.inputProtection.preserveCameraControls &&
    policy.inputProtection.preserveSelection &&
    Object.values(policy.workPlans).every((plan) => plan.maxWorkSliceMs <= 6)
  );
}

function interactionReasons(
  interaction: DiagnosticInteractionState | undefined,
): DiagnosticSchedulingReasonCode[] {
  const reasons: DiagnosticSchedulingReasonCode[] = [];
  if (interaction?.pageVisible === false) reasons.push('page_hidden_suspended');
  if (interaction?.pointerActive) reasons.push('pointer_interaction_active');
  if (interaction?.cameraActive) reasons.push('camera_interaction_active');
  if (interaction?.selectionActive) reasons.push('selection_interaction_active');
  if (
    typeof interaction?.msSinceLastInput === 'number' &&
    interaction.msSinceLastInput >= 0 &&
    interaction.msSinceLastInput < DIAGNOSTIC_INTERACTION_IDLE_GRACE_MS
  ) {
    reasons.push('recent_input_grace_period');
  }
  return reasons;
}

function modelLoadReasons(
  model: DiagnosticModelLoadState | undefined,
): DiagnosticSchedulingReasonCode[] {
  const reasons: DiagnosticSchedulingReasonCode[] = [];
  const elementCount = Math.max(model?.visibleElementCount ?? model?.elementCount ?? 0, 0);
  const diagnosticCount = Math.max(model?.diagnosticCount ?? 0, 0);

  if (
    model?.budgetState === 'over_budget' ||
    elementCount >= DIAGNOSTIC_OVER_BUDGET_MODEL_ELEMENT_LIMIT
  ) {
    reasons.push('model_over_budget_auto_diagnostics_suspended');
  } else if (
    model?.budgetState === 'deferred' ||
    elementCount >= DIAGNOSTIC_ORDINARY_MODEL_ELEMENT_LIMIT
  ) {
    reasons.push('model_budget_deferred_throttled');
  } else if (model?.budgetState === 'stale') {
    reasons.push('model_budget_stale_throttled');
  } else {
    reasons.push('ordinary_model_idle_background');
  }

  if (diagnosticCount >= DIAGNOSTIC_VOLUME_SUSPEND_LIMIT) {
    reasons.push('diagnostic_volume_over_budget_suspended');
  } else if (diagnosticCount >= DIAGNOSTIC_VOLUME_THROTTLE_LIMIT) {
    reasons.push('diagnostic_volume_throttled');
  }

  return reasons;
}

function pickDegradationLevel(
  reasonCodes: readonly DiagnosticSchedulingReasonCode[],
): DiagnosticDegradationLevel {
  const reasons = new Set(reasonCodes);
  if (
    reasons.has('page_hidden_suspended') ||
    reasons.has('model_over_budget_auto_diagnostics_suspended') ||
    reasons.has('diagnostic_volume_over_budget_suspended')
  ) {
    return 'suspended';
  }
  if (
    reasons.has('pointer_interaction_active') ||
    reasons.has('camera_interaction_active') ||
    reasons.has('selection_interaction_active') ||
    reasons.has('recent_input_grace_period')
  ) {
    return 'deferred';
  }
  if (
    reasons.has('model_budget_deferred_throttled') ||
    reasons.has('model_budget_stale_throttled') ||
    reasons.has('diagnostic_volume_throttled')
  ) {
    return 'throttled';
  }
  return 'none';
}

function buildOverlayPolicy(degradationLevel: DiagnosticDegradationLevel): DiagnosticOverlayPolicy {
  if (degradationLevel === 'suspended') {
    return {
      pointerEvents: 'none',
      maxRows: 16,
      maxMarkers: 64,
      allowStaleDuringInteraction: true,
    };
  }
  if (degradationLevel === 'throttled' || degradationLevel === 'deferred') {
    return {
      pointerEvents: 'none',
      maxRows: 48,
      maxMarkers: 250,
      allowStaleDuringInteraction: true,
    };
  }
  return {
    pointerEvents: 'none',
    maxRows: 120,
    maxMarkers: 1000,
    allowStaleDuringInteraction: true,
  };
}

function buildWorkPlan(opts: {
  kind: DiagnosticWorkKind;
  degradationLevel: DiagnosticDegradationLevel;
  reasonCodes: DiagnosticSchedulingReasonCode[];
}): DiagnosticWorkPlan {
  const base = basePlan(opts.kind);

  if (opts.degradationLevel === 'suspended') {
    return {
      ...base,
      runMode: opts.kind === 'diagnostic-overlay' ? 'render_stale' : 'manual_only',
      minDelayMs: 1000,
      throttleMs: Math.max(base.throttleMs, 2000),
      maxWorkSliceMs: 2,
      maxItemsPerBatch: Math.min(base.maxItemsPerBatch, 16),
      reasonCodes: opts.reasonCodes,
    };
  }

  if (opts.degradationLevel === 'deferred') {
    return {
      ...base,
      runMode: opts.kind === 'diagnostic-overlay' ? 'render_stale' : 'defer_until_idle',
      minDelayMs: Math.max(base.minDelayMs, DIAGNOSTIC_INTERACTION_IDLE_GRACE_MS),
      throttleMs: Math.max(base.throttleMs, 500),
      maxWorkSliceMs: Math.min(base.maxWorkSliceMs, 3),
      maxItemsPerBatch: Math.min(base.maxItemsPerBatch, 32),
      reasonCodes: opts.reasonCodes,
    };
  }

  if (opts.degradationLevel === 'throttled') {
    return {
      ...base,
      runMode: opts.kind === 'diagnostic-overlay' ? 'render_stale' : 'debounced',
      minDelayMs: Math.max(base.minDelayMs, 160),
      throttleMs: Math.max(base.throttleMs, 900),
      maxWorkSliceMs: Math.min(base.maxWorkSliceMs, 4),
      maxItemsPerBatch: Math.min(base.maxItemsPerBatch, 64),
      reasonCodes: opts.reasonCodes,
    };
  }

  return {
    ...base,
    reasonCodes: opts.reasonCodes,
  };
}

function basePlan(kind: DiagnosticWorkKind): Omit<DiagnosticWorkPlan, 'reasonCodes'> {
  switch (kind) {
    case 'advisor':
      return {
        kind,
        runMode: 'idle',
        minDelayMs: 80,
        throttleMs: 300,
        maxWorkSliceMs: 6,
        maxItemsPerBatch: 200,
        staleResultTtlMs: 5000,
      };
    case 'renderer-diagnostics':
      return {
        kind,
        runMode: 'idle',
        minDelayMs: 120,
        throttleMs: 400,
        maxWorkSliceMs: 6,
        maxItemsPerBatch: 160,
        staleResultTtlMs: 5000,
      };
    case 'diagnostic-overlay':
      return {
        kind,
        runMode: 'idle',
        minDelayMs: 0,
        throttleMs: 100,
        maxWorkSliceMs: 3,
        maxItemsPerBatch: 120,
        staleResultTtlMs: 10000,
      };
    case 'evidence-capture':
      return {
        kind,
        runMode: 'debounced',
        minDelayMs: 500,
        throttleMs: 1500,
        maxWorkSliceMs: 4,
        maxItemsPerBatch: 40,
        staleResultTtlMs: 30000,
      };
  }
}

function uniqueReasons(
  reasons: readonly DiagnosticSchedulingReasonCode[],
): DiagnosticSchedulingReasonCode[] {
  return [...new Set(reasons)].sort((a, b) => a.localeCompare(b));
}
