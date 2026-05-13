import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Element } from '@bim-ai/core';

import {
  SectionPlaceholderPane,
  SECTION_WORKBENCH_NO_WALL_CAPTION,
} from './SectionPlaceholderPane';
import { useBimStore } from '../../state/store';

vi.mock('./sectionViewportSvg', () => ({
  SectionViewportSvg: (p: { sectionCutId: string }) => (
    <div data-mock-section-viewport>{p.sectionCutId}</div>
  ),
}));

describe('SectionPlaceholderPane', () => {
  const rendered: Array<{ container: HTMLDivElement; root: ReturnType<typeof createRoot> }> = [];

  beforeAll(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
  });

  afterEach(() => {
    for (const { container, root } of rendered) {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
    rendered.length = 0;
    act(() => {
      useBimStore.getState().hydrateFromSnapshot({
        modelId: '',
        revision: 0,
        elements: {},
        violations: [],
      });
      useBimStore.setState({ selectedId: undefined, modelId: undefined });
    });
  });

  function renderPane(ui: ReactElement) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    rendered.push({ container, root });
    act(() => {
      root.render(ui);
    });
    return container;
  }

  const cutA: Extract<Element, { kind: 'section_cut' }> = {
    kind: 'section_cut',
    id: 'sc-a',
    name: 'Cut A',
    lineStartMm: { xMm: 0, yMm: 0 },
    lineEndMm: { xMm: 3000, yMm: 0 },
    cropDepthMm: 4500,
  };

  const cutB: Extract<Element, { kind: 'section_cut' }> = {
    kind: 'section_cut',
    id: 'sc-b',
    name: 'Cut B',
    lineStartMm: { xMm: 0, yMm: 0 },
    lineEndMm: { xMm: 1000, yMm: 0 },
  };

  it('explains missing modelId when cuts exist', () => {
    act(() => {
      useBimStore.getState().hydrateFromSnapshot({
        modelId: '',
        revision: 1,
        elements: { 'sc-a': cutA },
        violations: [],
      });
    });
    const el = renderPane(<SectionPlaceholderPane activeLevelLabel="L1" />);
    expect(el.textContent).toContain('modelId');
    expect(el.querySelector('[data-testid="section-workbench-preview-svg"]')).toBeNull();
  });

  it('renders live preview when modelId is set', () => {
    act(() => {
      useBimStore.getState().hydrateFromSnapshot({
        modelId: 'm1',
        revision: 1,
        elements: { 'sc-a': cutA, 'sc-b': cutB },
        violations: [],
      });
    });
    const el = renderPane(<SectionPlaceholderPane activeLevelLabel="L1" modelId="m1" />);
    const wrap = el.querySelector('[data-testid="section-workbench-preview-svg"]');
    expect(wrap).toBeTruthy();
    expect(wrap?.querySelector('[data-mock-section-viewport]')?.textContent).toBe('sc-a');
    expect(el.querySelector('[data-testid="section-spatial-context"]')?.textContent).toContain(
      'Cut run 3,000 mm',
    );
  });

  it('routes section context jump actions', () => {
    const onOpenSourcePlan = vi.fn();
    const onOpen3dContext = vi.fn();
    act(() => {
      useBimStore.getState().hydrateFromSnapshot({
        modelId: 'm1',
        revision: 1,
        elements: { 'sc-a': cutA },
        violations: [],
      });
    });
    const el = renderPane(
      <SectionPlaceholderPane
        activeLevelLabel="L1"
        modelId="m1"
        onOpenSourcePlan={onOpenSourcePlan}
        onOpen3dContext={onOpen3dContext}
      />,
    );
    const sourceBtn = el.querySelector(
      '[data-testid="section-open-source-plan"]',
    ) as HTMLButtonElement | null;
    const contextBtn = el.querySelector(
      '[data-testid="section-open-3d-context"]',
    ) as HTMLButtonElement | null;
    expect(sourceBtn).toBeTruthy();
    expect(contextBtn).toBeTruthy();
    act(() => sourceBtn?.click());
    act(() => contextBtn?.click());
    expect(onOpenSourcePlan).toHaveBeenCalledOnce();
    expect(onOpen3dContext).toHaveBeenCalledOnce();
  });

  it('preview follows selected section_cut', () => {
    act(() => {
      useBimStore.getState().hydrateFromSnapshot({
        modelId: 'm1',
        revision: 1,
        elements: { 'sc-a': cutA, 'sc-b': cutB },
        violations: [],
      });
      useBimStore.setState({ selectedId: 'sc-b' });
    });
    const el = renderPane(<SectionPlaceholderPane activeLevelLabel="L1" modelId="m1" />);
    const wrap = el.querySelector('[data-testid="section-workbench-preview-svg"]');
    expect(wrap?.querySelector('[data-mock-section-viewport]')?.textContent).toBe('sc-b');
  });

  it('selects section cut row on click', () => {
    act(() => {
      useBimStore.getState().hydrateFromSnapshot({
        modelId: 'm1',
        revision: 1,
        elements: { 'sc-a': cutA, 'sc-b': cutB },
        violations: [],
      });
    });
    act(() => {
      useBimStore.setState({ selectedId: undefined });
    });
    const el = renderPane(<SectionPlaceholderPane activeLevelLabel="L1" modelId="m1" />);
    const buttons = Array.from(el.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Cut B'),
    );
    expect(buttons.length).toBeGreaterThan(0);
    act(() => {
      buttons[0].click();
    });
    expect(useBimStore.getState().selectedId).toBe('sc-b');
  });

  it('shows sheet deep link targeting the preview cut', () => {
    const sheet: Extract<Element, { kind: 'sheet' }> = {
      kind: 'sheet',
      id: 'sh-x',
      name: 'GA-01',
      viewportsMm: [{ viewRef: 'section:sc-a' }],
    };
    act(() => {
      useBimStore.getState().hydrateFromSnapshot({
        modelId: 'm1',
        revision: 1,
        elements: { 'sc-a': cutA, 'sh-x': sheet },
        violations: [],
      });
    });
    const el = renderPane(<SectionPlaceholderPane activeLevelLabel="L1" modelId="m1" />);
    expect(el.textContent).toContain('Select sheet · GA-01');
    const sheetBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Select sheet · GA-01'),
    );
    expect(sheetBtn).toBeTruthy();
    act(() => {
      sheetBtn!.click();
    });
    expect(useBimStore.getState().selectedId).toBe('sh-x');
  });

  it('exports stable empty-wall caption phrase', () => {
    expect(SECTION_WORKBENCH_NO_WALL_CAPTION).toBe(
      'No wall primitives for this cut in the current snapshot.',
    );
  });
});
