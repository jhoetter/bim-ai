import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { disclosureStorageKey, PersistedDisclosureSection } from './PersistedDisclosureSection';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('<PersistedDisclosureSection />', () => {
  it('toggles with pointer interaction and persists the state', () => {
    const { getByTestId, container } = render(
      <PersistedDisclosureSection
        title="Visibility"
        disclosureId="plan.visibility.pv-1"
        testId="disc"
      >
        <div>Panel body</div>
      </PersistedDisclosureSection>,
    );

    const toggle = getByTestId('disc-toggle');
    const body = container.querySelector<HTMLElement>(`#${toggle.getAttribute('aria-controls')}`);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(body?.hidden).toBe(false);
    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(body?.hidden).toBe(true);
    expect(localStorage.getItem(disclosureStorageKey('plan.visibility.pv-1'))).toBe('closed');
  });

  it('restores persisted state for the same disclosure key', () => {
    localStorage.setItem(disclosureStorageKey('3d.graphics.vp-main-iso'), 'closed');

    const { getByTestId, container } = render(
      <PersistedDisclosureSection
        title="Graphics"
        disclosureId="3d.graphics.vp-main-iso"
        testId="disc"
      >
        <div>Graphics body</div>
      </PersistedDisclosureSection>,
    );

    const toggle = getByTestId('disc-toggle');
    const body = container.querySelector<HTMLElement>(`#${toggle.getAttribute('aria-controls')}`);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(body?.hidden).toBe(true);
  });

  it('toggles with keyboard activation', () => {
    const { getByTestId, container } = render(
      <PersistedDisclosureSection
        title="Crop Depth"
        disclosureId="section.crop-depth.sec-1"
        testId="disc"
      >
        <div>Depth editor</div>
      </PersistedDisclosureSection>,
    );

    const toggle = getByTestId('disc-toggle');
    const body = container.querySelector<HTMLElement>(`#${toggle.getAttribute('aria-controls')}`);
    fireEvent.keyDown(toggle, { key: 'Enter' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(body?.hidden).toBe(true);
  });
});
