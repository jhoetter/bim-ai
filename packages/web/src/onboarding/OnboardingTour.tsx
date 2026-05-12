import { type JSX, type KeyboardEvent, useEffect, useState } from 'react';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import {
  ONBOARDING_STEPS,
  markOnboardingCompleted,
  nextStep,
  readOnboardingProgress,
  type OnboardingStep,
} from './tour';

/**
 * Onboarding tour — spec §24 popover sequence.
 *
 * Lightweight renderer that pins a tooltip to the step's `target` selector
 * (resolved with `document.querySelector`). Falls back to centered overlay
 * if the target is missing. Esc cancels; Enter / right arrow advances;
 * left arrow steps back. Persists completion via `tour.ts` storage.
 */

export interface OnboardingTourProps {
  /** When false the tour stays dormant. Caller controls visibility so a
   * "Replay onboarding" entry in the welcome menu can re-open it. */
  open: boolean;
  onClose: () => void;
  /** Called when the user reaches the final step + advances past it. */
  onComplete?: () => void;
}

export function OnboardingTour({
  open,
  onClose,
  onComplete,
}: OnboardingTourProps): JSX.Element | null {
  const [index, setIndex] = useState<number>(() => readOnboardingProgress().currentIndex);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    const progress = readOnboardingProgress();
    const nextIndex = progress.completed
      ? 0
      : Math.min(progress.currentIndex, ONBOARDING_STEPS.length - 1);
    setIndex(nextIndex);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const step = ONBOARDING_STEPS[index];
    if (!step) return;
    const el = document.querySelector(step.target);
    if (el && 'getBoundingClientRect' in el) {
      setRect((el as Element).getBoundingClientRect());
    } else {
      setRect(null);
    }
  }, [open, index]);

  if (!open) return null;
  const step = ONBOARDING_STEPS[index];
  if (!step) return null;

  const handleKey = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'Enter' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = nextStep(index, 1);
      if (next === null) {
        markOnboardingCompleted();
        onComplete?.();
        onClose();
      } else {
        setIndex(next);
      }
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      const prev = nextStep(index, -1);
      if (prev !== null) setIndex(prev);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding tour"
      data-testid="onboarding-tour"
      onKeyDown={handleKey}
      tabIndex={0}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 65,
        pointerEvents: 'auto',
      }}
    >
      <Spotlight rect={rect} />
      <PopoverCard
        step={step}
        rect={rect}
        index={index}
        total={ONBOARDING_STEPS.length}
        onNext={() => {
          const next = nextStep(index, 1);
          if (next === null) {
            markOnboardingCompleted();
            onComplete?.();
            onClose();
          } else {
            setIndex(next);
          }
        }}
        onPrev={() => {
          const prev = nextStep(index, -1);
          if (prev !== null) setIndex(prev);
        }}
        onSkip={() => {
          markOnboardingCompleted();
          onClose();
        }}
      />
    </div>
  );
}

function Spotlight({ rect }: { rect: DOMRect | null }): JSX.Element {
  if (!rect) {
    return (
      <div
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, background: 'rgba(8, 12, 20, 0.45)' }}
      />
    );
  }
  // Four-rectangle dim around the spotlight target.
  const { top, left, width, height } = rect;
  const right = left + width;
  const bottom = top + height;
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          height: top,
          background: 'rgba(8, 12, 20, 0.45)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top,
          width: left,
          height,
          background: 'rgba(8, 12, 20, 0.45)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: right,
          top,
          right: 0,
          height,
          background: 'rgba(8, 12, 20, 0.45)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: bottom,
          right: 0,
          bottom: 0,
          background: 'rgba(8, 12, 20, 0.45)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height,
          border: '2px solid var(--color-accent)',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 0 0 9999px rgba(8, 12, 20, 0.0)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

function PopoverCard({
  step,
  rect,
  index,
  total,
  onNext,
  onPrev,
  onSkip,
}: {
  step: OnboardingStep;
  rect: DOMRect | null;
  index: number;
  total: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}): JSX.Element {
  const cardStyle: React.CSSProperties = rect
    ? {
        position: 'absolute',
        left: Math.max(12, Math.min(rect.left, window.innerWidth - 380 - 12)),
        top: Math.min(rect.bottom + 12, window.innerHeight - 220 - 12),
        width: 380,
      }
    : {
        position: 'absolute',
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
        width: 380,
      };
  return (
    <div
      style={cardStyle}
      className="rounded-lg border border-border bg-surface px-4 py-3 shadow-elev-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <Icons.agent size={ICON_SIZE.chrome} aria-hidden="true" className="text-accent" />
        <div
          className="text-xs uppercase text-muted"
          style={{ letterSpacing: 'var(--text-eyebrow-tracking)' }}
        >
          Tour · step {index + 1} of {total}
        </div>
      </div>
      <h3 className="mb-1 text-md font-medium text-foreground">{step.title}</h3>
      <p className="mb-3 text-sm text-muted">{step.body}</p>
      {step.hint ? (
        <kbd className="mb-3 inline-block rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-muted">
          {step.hint}
        </kbd>
      ) : null}
      <div className="flex items-center justify-between">
        <button type="button" onClick={onSkip} className="text-xs text-muted hover:text-foreground">
          Skip tour
        </button>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPrev}
            disabled={index === 0}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground hover:bg-surface-strong disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-md bg-accent px-3 py-1 text-xs text-accent-foreground hover:opacity-90"
          >
            {index + 1 === total ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
