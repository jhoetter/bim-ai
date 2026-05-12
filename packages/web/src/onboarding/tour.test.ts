import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ONBOARDING_STEPS,
  markOnboardingCompleted,
  nextStep,
  readOnboardingProgress,
  resetOnboarding,
} from './tour';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe('Onboarding tour — spec §24', () => {
  it('exposes 5 steps in spec order', () => {
    expect(ONBOARDING_STEPS).toHaveLength(5);
    expect(ONBOARDING_STEPS[0]!.title).toMatch(/tabs/i);
    expect(ONBOARDING_STEPS[1]!.title).toMatch(/primary sidebar/i);
    expect(ONBOARDING_STEPS[2]!.title).toMatch(/ribbon/i);
    expect(ONBOARDING_STEPS[3]!.title).toMatch(/secondary sidebar/i);
    expect(ONBOARDING_STEPS[4]!.title).toMatch(/footer/i);
  });

  it('targets canonical seven-region shell selectors', () => {
    expect(ONBOARDING_STEPS.map((step) => step.target)).toEqual([
      '[data-testid="workspace-header"]',
      '[data-testid="app-shell-primary-sidebar"]',
      '[data-testid="ribbon-bar"]',
      '[data-testid="app-shell-secondary-sidebar"]',
      '[data-testid="status-bar"]',
    ]);
  });

  it('readOnboardingProgress defaults to incomplete', () => {
    expect(readOnboardingProgress()).toEqual({ completed: false, currentIndex: 0 });
  });

  it('mark + read flips completed bit', () => {
    markOnboardingCompleted();
    expect(readOnboardingProgress().completed).toBe(true);
  });

  it('reset clears completion', () => {
    markOnboardingCompleted();
    resetOnboarding();
    expect(readOnboardingProgress().completed).toBe(false);
  });

  it('nextStep advances and clamps', () => {
    expect(nextStep(0)).toBe(1);
    expect(nextStep(4)).toBeNull();
    expect(nextStep(0, -1)).toBe(0);
    expect(nextStep(2, -1)).toBe(1);
  });
});
