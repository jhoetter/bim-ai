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
    title: 'Tabs + Cmd+K are your fastest view switcher.',
    body: 'Open plan, 3D, section, sheet, and schedule contexts from tabs, then use Cmd+K for direct command jumps.',
    hint: 'Cmd+K / ⌘K',
  },
  {
    target: '[data-testid="app-shell-primary-sidebar"]',
    title: 'Primary sidebar is full-height navigation.',
    body: 'Project browser, new-view creation, and settings discovery live here. Use it to open canonical tabs and seed workflows.',
  },
  {
    target: '[data-testid="ribbon-bar"]',
    title: 'Ribbon owns edit commands by active context.',
    body: 'Tool groups change with plan, 3D, section, sheet, and schedule modes so command ownership stays explicit.',
  },
  {
    target: '[data-testid="app-shell-secondary-sidebar"]',
    title: 'Secondary sidebar owns view semantics.',
    body: 'Use this rail for graphics, discipline lens, section crop/context, and schedule/sheet controls; element properties stay isolated on selection.',
  },
  {
    target: '[data-testid="status-bar"]',
    title: 'Footer tracks global status and QA.',
    body: 'Advisor counts, jobs, snaps, undo/redo, and connection state stay visible while you move between authoring and documentation flows.',
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
