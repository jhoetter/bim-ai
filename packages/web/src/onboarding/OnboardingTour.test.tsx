import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { OnboardingTour } from './OnboardingTour';
import { markOnboardingCompleted, ONBOARDING_STEPS, resetOnboarding } from './tour';

beforeEach(() => {
  resetOnboarding();
});
afterEach(() => {
  cleanup();
});

describe('<OnboardingTour /> — spec §24', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(<OnboardingTour open={false} onClose={() => undefined} />);
    expect(queryByTestId('onboarding-tour')).toBeNull();
  });

  it('renders the first step title and body when open', () => {
    const { getByText, getByTestId } = render(
      <OnboardingTour open={true} onClose={() => undefined} />,
    );
    expect(getByTestId('onboarding-tour')).toBeTruthy();
    expect(getByText(ONBOARDING_STEPS[0]!.title)).toBeTruthy();
    expect(getByText(ONBOARDING_STEPS[0]!.body)).toBeTruthy();
  });

  it('Next advances steps until Finish', () => {
    const onClose = vi.fn();
    const onComplete = vi.fn();
    const { getByText } = render(
      <OnboardingTour open={true} onClose={onClose} onComplete={onComplete} />,
    );
    for (let i = 0; i < ONBOARDING_STEPS.length - 1; i++) {
      fireEvent.click(getByText('Next'));
    }
    fireEvent.click(getByText('Finish'));
    expect(onComplete).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('Skip closes immediately', () => {
    const onClose = vi.fn();
    const { getByText } = render(<OnboardingTour open={true} onClose={onClose} />);
    fireEvent.click(getByText('Skip tour'));
    expect(onClose).toHaveBeenCalled();
  });

  it('Back is disabled on the first step', () => {
    const { getByText } = render(<OnboardingTour open={true} onClose={() => undefined} />);
    expect((getByText('Back') as HTMLButtonElement).disabled).toBe(true);
  });

  it('Escape closes', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<OnboardingTour open={true} onClose={onClose} />);
    fireEvent.keyDown(getByTestId('onboarding-tour'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('restarts from the first step when replaying after completion', () => {
    markOnboardingCompleted();
    const { rerender, getByText } = render(
      <OnboardingTour open={false} onClose={() => undefined} />,
    );

    resetOnboarding();
    rerender(<OnboardingTour open={true} onClose={() => undefined} />);
    expect(getByText(ONBOARDING_STEPS[0]!.title)).toBeTruthy();
  });
});
