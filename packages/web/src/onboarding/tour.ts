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
    target: '[data-testid="workspace-header"]',
    title: 'Tabs are your view switcher.',
    body: 'Use tabs to move between plan, 3D, sheet, schedule, and review contexts.',
    hint: 'Cmd+K',
  },
  {
    target: '[data-testid="app-shell-primary-sidebar"]',
    title: 'Primary sidebar is navigation-only.',
    body: 'Project, views, sheets, and schedules are organized here. Use it to open and manage tabs.',
  },
  {
    target: '[data-testid="ribbon-bar"]',
    title: 'Ribbon owns editing commands.',
    body: 'Authoring and modify tools are grouped by active view and command context.',
  },
  {
    target: '[data-testid="app-shell-secondary-sidebar"]',
    title: 'Secondary sidebar owns view settings.',
    body: 'View-wide graphics, visibility, and mode options live here. Element properties appear separately only when selected.',
  },
  {
    target: '[data-testid="status-bar"]',
    title: 'Footer tracks global status.',
    body: 'Advisor, activity, jobs, snaps, grid, and undo/redo stay visible across every view.',
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
