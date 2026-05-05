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
    expect(ONBOARDING_STEPS[0]!.title).toMatch(/canvas/i);
    expect(ONBOARDING_STEPS[1]!.title).toMatch(/snap modes/i);
    expect(ONBOARDING_STEPS[2]!.title).toMatch(/switch to 3D/i);
    expect(ONBOARDING_STEPS[3]!.title).toMatch(/Project Browser/i);
    expect(ONBOARDING_STEPS[4]!.title).toMatch(/all shortcuts/i);
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
