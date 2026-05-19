import { describe, expect, it } from 'vitest';

import {
  DIAGNOSTIC_INTERACTION_IDLE_GRACE_MS,
  DIAGNOSTIC_ORDINARY_MODEL_ELEMENT_LIMIT,
  DIAGNOSTIC_OVER_BUDGET_MODEL_ELEMENT_LIMIT,
  DIAGNOSTIC_VOLUME_SUSPEND_LIMIT,
  DIAGNOSTIC_VOLUME_THROTTLE_LIMIT,
  buildDiagnosticUiSchedulingPolicy,
  diagnosticPolicyPreservesInteraction,
} from './diagnosticSchedulingPolicy';

describe('diagnostic UI scheduling policy - BIR-L06', () => {
  it('keeps Advisor and renderer diagnostics off the synchronous path for ordinary idle models', () => {
    const policy = buildDiagnosticUiSchedulingPolicy({
      interaction: {
        pageVisible: true,
        msSinceLastInput: DIAGNOSTIC_INTERACTION_IDLE_GRACE_MS,
      },
      model: {
        budgetState: 'in_budget',
        elementCount: DIAGNOSTIC_ORDINARY_MODEL_ELEMENT_LIMIT - 1,
        diagnosticCount: DIAGNOSTIC_VOLUME_THROTTLE_LIMIT - 1,
      },
    });

    expect(policy.format).toBe('diagnosticUiSchedulingPolicy_v1');
    expect(policy.degradationLevel).toBe('none');
    expect(policy.reasonCodes).toEqual(['ordinary_model_idle_background']);
    expect(policy.inputProtection).toEqual({
      maxSynchronousDiagnosticMs: 0,
      overlayPointerEvents: 'none',
      preservePointerEvents: true,
      preserveCameraControls: true,
      preserveSelection: true,
    });
    expect(policy.overlay.pointerEvents).toBe('none');
    expect(policy.workPlans.advisor.runMode).toBe('idle');
    expect(policy.workPlans['renderer-diagnostics'].runMode).toBe('idle');
    expect(policy.workPlans.advisor.maxWorkSliceMs).toBeLessThanOrEqual(6);
    expect(policy.workPlans['renderer-diagnostics'].maxWorkSliceMs).toBeLessThanOrEqual(6);
    expect(diagnosticPolicyPreservesInteraction(policy)).toBe(true);
  });

  it('defers automatic diagnostics while pointer, camera, or selection interaction is active', () => {
    const policy = buildDiagnosticUiSchedulingPolicy({
      interaction: {
        pointerActive: true,
        cameraActive: true,
        selectionActive: true,
        msSinceLastInput: 32,
      },
      model: {
        budgetState: 'in_budget',
        elementCount: 100,
        diagnosticCount: 0,
      },
    });

    expect(policy.degradationLevel).toBe('deferred');
    expect(policy.reasonCodes).toEqual([
      'camera_interaction_active',
      'ordinary_model_idle_background',
      'pointer_interaction_active',
      'recent_input_grace_period',
      'selection_interaction_active',
    ]);
    expect(policy.workPlans.advisor.runMode).toBe('defer_until_idle');
    expect(policy.workPlans['renderer-diagnostics'].runMode).toBe('defer_until_idle');
    expect(policy.workPlans['evidence-capture'].runMode).toBe('defer_until_idle');
    expect(policy.workPlans['diagnostic-overlay'].runMode).toBe('render_stale');
    expect(policy.workPlans.advisor.minDelayMs).toBeGreaterThanOrEqual(
      DIAGNOSTIC_INTERACTION_IDLE_GRACE_MS,
    );
    expect(policy.workPlans['renderer-diagnostics'].maxItemsPerBatch).toBeLessThanOrEqual(32);
    expect(diagnosticPolicyPreservesInteraction(policy)).toBe(true);
  });

  it('treats very recent input as an idle grace period even after the pointer is released', () => {
    const policy = buildDiagnosticUiSchedulingPolicy({
      interaction: {
        msSinceLastInput: DIAGNOSTIC_INTERACTION_IDLE_GRACE_MS - 1,
      },
      model: {
        budgetState: 'in_budget',
        elementCount: 100,
      },
    });

    expect(policy.degradationLevel).toBe('deferred');
    expect(policy.reasonCodes).toContain('recent_input_grace_period');
    expect(policy.workPlans.advisor.runMode).toBe('defer_until_idle');
    expect(policy.workPlans['renderer-diagnostics'].runMode).toBe('defer_until_idle');
  });

  it('throttles diagnostics and caps overlay rows for deferred or stale model budgets', () => {
    const deferred = buildDiagnosticUiSchedulingPolicy({
      interaction: { msSinceLastInput: DIAGNOSTIC_INTERACTION_IDLE_GRACE_MS },
      model: {
        budgetState: 'deferred',
        elementCount: DIAGNOSTIC_ORDINARY_MODEL_ELEMENT_LIMIT,
        diagnosticCount: DIAGNOSTIC_VOLUME_THROTTLE_LIMIT,
      },
    });
    const stale = buildDiagnosticUiSchedulingPolicy({
      interaction: { msSinceLastInput: DIAGNOSTIC_INTERACTION_IDLE_GRACE_MS },
      model: {
        budgetState: 'stale',
        elementCount: 100,
      },
    });

    expect(deferred.degradationLevel).toBe('throttled');
    expect(deferred.reasonCodes).toEqual([
      'diagnostic_volume_throttled',
      'model_budget_deferred_throttled',
    ]);
    expect(deferred.workPlans.advisor.runMode).toBe('debounced');
    expect(deferred.workPlans['renderer-diagnostics'].throttleMs).toBeGreaterThanOrEqual(900);
    expect(deferred.overlay.maxRows).toBe(48);

    expect(stale.degradationLevel).toBe('throttled');
    expect(stale.reasonCodes).toEqual(['model_budget_stale_throttled']);
    expect(stale.workPlans['renderer-diagnostics'].runMode).toBe('debounced');
  });

  it('suspends automatic heavy diagnostics for over-budget models but leaves stale overlay readouts non-interactive', () => {
    const policy = buildDiagnosticUiSchedulingPolicy({
      interaction: {
        pageVisible: true,
        msSinceLastInput: DIAGNOSTIC_INTERACTION_IDLE_GRACE_MS,
      },
      model: {
        budgetState: 'over_budget',
        elementCount: DIAGNOSTIC_OVER_BUDGET_MODEL_ELEMENT_LIMIT,
        diagnosticCount: DIAGNOSTIC_VOLUME_SUSPEND_LIMIT,
      },
    });

    expect(policy.degradationLevel).toBe('suspended');
    expect(policy.reasonCodes).toEqual([
      'diagnostic_volume_over_budget_suspended',
      'model_over_budget_auto_diagnostics_suspended',
    ]);
    expect(policy.workPlans.advisor.runMode).toBe('manual_only');
    expect(policy.workPlans['renderer-diagnostics'].runMode).toBe('manual_only');
    expect(policy.workPlans['evidence-capture'].runMode).toBe('manual_only');
    expect(policy.workPlans['diagnostic-overlay'].runMode).toBe('render_stale');
    expect(policy.overlay.pointerEvents).toBe('none');
    expect(policy.overlay.maxRows).toBe(16);
    expect(policy.overlay.maxMarkers).toBe(64);
    expect(diagnosticPolicyPreservesInteraction(policy)).toBe(true);
  });

  it('suspends diagnostics when the page is hidden', () => {
    const policy = buildDiagnosticUiSchedulingPolicy({
      interaction: {
        pageVisible: false,
        msSinceLastInput: 1000,
      },
      model: {
        budgetState: 'in_budget',
        elementCount: 100,
      },
    });

    expect(policy.degradationLevel).toBe('suspended');
    expect(policy.reasonCodes).toEqual(['ordinary_model_idle_background', 'page_hidden_suspended']);
    expect(policy.workPlans.advisor.runMode).toBe('manual_only');
    expect(policy.workPlans['renderer-diagnostics'].runMode).toBe('manual_only');
    expect(policy.workPlans['diagnostic-overlay'].runMode).toBe('render_stale');
  });
});
