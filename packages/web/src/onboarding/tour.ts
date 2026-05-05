/**
 * Onboarding tour — spec §24.
 *
 * 5-step popover sequence over the redesigned chrome. Persisted via
 * localStorage so a returning user is not re-onboarded; the tour is
 * dismissable with `Esc` and resumable via the welcome screen.
 */

export interface OnboardingStep {
  /** DOM target — `[data-tour="..."]` selector or aria-label. */
  target: string;
  title: string;
  body: string;
  /** Hint shown trailing the body (e.g. keyboard shortcut). */
  hint?: string;
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    target: '[data-testid="app-shell-canvas"]',
    title: 'This is your canvas.',
    body: 'Press W to draw a wall, or pick another tool from the floating palette above.',
    hint: 'W',
  },
  {
    target: '[data-testid="status-bar"]',
    title: 'Snap modes live in the status bar.',
    body: 'Endpoint, midpoint, intersection — toggle individually or cycle them with F3.',
    hint: 'F3',
  },
  {
    target: '[data-testid="topbar"]',
    title: 'Switch to 3D with `2`.',
    body: 'The ViewCube top-right orients the camera.',
    hint: '2',
  },
  {
    target: '[data-testid="app-shell-left-rail"]',
    title: 'Open the Project Browser on the left.',
    body: 'Levels, views, sheets, schedules — every model artifact lives here.',
  },
  {
    target: 'body',
    title: 'Press ? any time to see all shortcuts.',
    body: 'The keyboard cheatsheet covers tool hotkeys, mode jumps, and pointer modifiers.',
    hint: '?',
  },
];

const STORAGE_KEY = 'bim.onboarding-completed';

export interface OnboardingProgress {
  completed: boolean;
  currentIndex: number;
}

export function readOnboardingProgress(): OnboardingProgress {
  if (typeof localStorage === 'undefined') return { completed: false, currentIndex: 0 };
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true'
      ? { completed: true, currentIndex: ONBOARDING_STEPS.length }
      : { completed: false, currentIndex: 0 };
  } catch {
    return { completed: false, currentIndex: 0 };
  }
}

export function markOnboardingCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, 'true');
  } catch {
    /* noop */
  }
}

export function resetOnboarding(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

/** Compute the next index, or `null` to mark the tour finished. */
export function nextStep(current: number, delta: 1 | -1 = 1): number | null {
  const next = current + delta;
  if (next < 0) return 0;
  if (next >= ONBOARDING_STEPS.length) return null;
  return next;
}
