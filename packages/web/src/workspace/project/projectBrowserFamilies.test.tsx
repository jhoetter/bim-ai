/**
 * §1.6.11 — ProjectBrowser Families section tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { ProjectBrowserV3 } from './ProjectBrowser';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const familyExtrusion: Element = {
  kind: 'family_extrusion',
  id: 'fe-01',
  profilePoints: [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
    { x: 1000, y: 500 },
  ],
  depthMm: 3000,
} as unknown as Element;

const familyRevolve: Element = {
  kind: 'family_revolve',
  id: 'fr-01',
  profilePoints: [
    { x: 0, y: 0 },
    { x: 500, y: 0 },
  ],
  axisMm: { x: 0, z: 0 },
  angleDeg: 360,
} as unknown as Element;

const familyVoid: Element = {
  kind: 'family_void',
  id: 'fv-01',
  profilePoints: [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 400 },
  ],
  depthMm: 200,
} as unknown as Element;

const familyBlend: Element = {
  kind: 'family_blend',
  id: 'fb-01',
  bottomProfilePoints: [
    { x: 0, y: 0 },
    { x: 1000, y: 0 },
  ],
  topProfilePoints: [
    { x: 200, y: 0 },
    { x: 800, y: 0 },
  ],
  heightMm: 2000,
} as unknown as Element;

const familySweep: Element = {
  kind: 'family_sweep',
  id: 'fs-01',
  profilePoints: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
  ],
  pathPoints: [
    { x: 0, y: 0, z: 0 },
    { x: 2000, y: 0, z: 0 },
  ],
} as unknown as Element;

function makeProps(elements: Element[] = []) {
  return {
    elements,
    activeViewId: null as string | null,
    onActivateView: vi.fn(),
    onRenameView: vi.fn(),
    onDeleteView: vi.fn(),
    onDuplicateView: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectBrowser families section — §1.6.11', () => {
  it('renders pb-section-families', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeProps()} />);
    expect(getByTestId('pb-section-families')).toBeTruthy();
  });

  it('shows one leaf per family element when expanded', () => {
    const props = makeProps([familyExtrusion, familyRevolve, familyVoid, familyBlend, familySweep]);
    const { getByTestId } = render(<ProjectBrowserV3 {...props} />);
    // Expand the section first
    const toggle = getByTestId('pb-section-families').querySelector('button') as HTMLElement;
    fireEvent.click(toggle);
    expect(getByTestId('pb-family-fe-01')).toBeTruthy();
    expect(getByTestId('pb-family-fr-01')).toBeTruthy();
    expect(getByTestId('pb-family-fv-01')).toBeTruthy();
    expect(getByTestId('pb-family-fb-01')).toBeTruthy();
    expect(getByTestId('pb-family-fs-01')).toBeTruthy();
  });

  it('pb-section-families is collapsed by default', () => {
    const props = makeProps([familyExtrusion]);
    const { getByTestId, queryByTestId } = render(<ProjectBrowserV3 {...props} />);
    // Section exists but family leaves are not rendered (collapsed)
    expect(getByTestId('pb-section-families')).toBeTruthy();
    expect(queryByTestId('pb-family-fe-01')).toBeNull();
  });

  it('expands and collapses the families section on button click', () => {
    const props = makeProps([familyExtrusion]);
    const { getByTestId, queryByTestId } = render(<ProjectBrowserV3 {...props} />);
    const toggle = getByTestId('pb-section-families').querySelector('button') as HTMLElement;
    // Expand
    fireEvent.click(toggle);
    expect(getByTestId('pb-family-fe-01')).toBeTruthy();
    // Collapse again
    fireEvent.click(toggle);
    expect(queryByTestId('pb-family-fe-01')).toBeNull();
  });

  it('shows family elements grouped: structural kinds in Structural group', () => {
    const props = makeProps([familyExtrusion, familyBlend, familySweep]);
    const { getByTestId, getByText } = render(<ProjectBrowserV3 {...props} />);
    const toggle = getByTestId('pb-section-families').querySelector('button') as HTMLElement;
    fireEvent.click(toggle);
    expect(getByText('Structural')).toBeTruthy();
    expect(getByTestId('pb-family-fe-01')).toBeTruthy();
    expect(getByTestId('pb-family-fb-01')).toBeTruthy();
    expect(getByTestId('pb-family-fs-01')).toBeTruthy();
  });

  it('shows family_void in Voids group', () => {
    const props = makeProps([familyVoid]);
    const { getByTestId, getByText } = render(<ProjectBrowserV3 {...props} />);
    const toggle = getByTestId('pb-section-families').querySelector('button') as HTMLElement;
    fireEvent.click(toggle);
    expect(getByText('Voids')).toBeTruthy();
    expect(getByTestId('pb-family-fv-01')).toBeTruthy();
  });

  it('shows family_revolve in Revolves group', () => {
    const props = makeProps([familyRevolve]);
    const { getByTestId, getByText } = render(<ProjectBrowserV3 {...props} />);
    const toggle = getByTestId('pb-section-families').querySelector('button') as HTMLElement;
    fireEvent.click(toggle);
    expect(getByText('Revolves')).toBeTruthy();
    expect(getByTestId('pb-family-fr-01')).toBeTruthy();
  });
});
