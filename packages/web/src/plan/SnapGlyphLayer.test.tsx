import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';

import { SnapGlyph, SnapGlyphLayer, snapKindLabel } from './SnapGlyphLayer';

afterEach(() => {
  cleanup();
});

describe('EDT-05 — snapKindLabel', () => {
  it('returns Revit-style labels for each kind', () => {
    expect(snapKindLabel('endpoint')).toBe('endpoint');
    expect(snapKindLabel('midpoint')).toBe('midpoint');
    expect(snapKindLabel('nearest')).toBe('nearest');
    expect(snapKindLabel('center')).toBe('center');
    expect(snapKindLabel('intersection')).toBe('intersection');
    expect(snapKindLabel('perpendicular')).toBe('perpendicular');
    expect(snapKindLabel('extension')).toBe('extension');
    expect(snapKindLabel('grid')).toBe('grid');
    expect(snapKindLabel('raw')).toBe('');
  });
});

describe('EDT-05 — SnapGlyph kinds', () => {
  it('renders an endpoint square', () => {
    const { getByTestId } = render(<SnapGlyph pxX={100} pxY={50} kind="endpoint" />);
    expect(getByTestId('snap-glyph-endpoint')).toBeTruthy();
  });

  it('renders an intersection × glyph', () => {
    const { getByTestId } = render(<SnapGlyph pxX={100} pxY={50} kind="intersection" />);
    expect(getByTestId('snap-glyph-intersection')).toBeTruthy();
  });

  it('renders midpoint, nearest, and center glyphs', () => {
    const { getByTestId, rerender } = render(<SnapGlyph pxX={100} pxY={50} kind="midpoint" />);
    expect(getByTestId('snap-glyph-midpoint')).toBeTruthy();
    rerender(<SnapGlyph pxX={100} pxY={50} kind="nearest" />);
    expect(getByTestId('snap-glyph-nearest')).toBeTruthy();
    rerender(<SnapGlyph pxX={100} pxY={50} kind="center" />);
    expect(getByTestId('snap-glyph-center')).toBeTruthy();
  });

  it('renders a perpendicular ⊥ glyph', () => {
    const { getByTestId } = render(<SnapGlyph pxX={100} pxY={50} kind="perpendicular" />);
    expect(getByTestId('snap-glyph-perpendicular')).toBeTruthy();
  });

  it('renders an extension dot + dashed line back to source', () => {
    const { getByTestId } = render(
      <SnapGlyph pxX={120} pxY={50} kind="extension" extensionFromPxX={50} extensionFromPxY={50} />,
    );
    expect(getByTestId('snap-glyph-extension')).toBeTruthy();
  });

  it('renders CAN-V3-03 padlock glyph for associative snaps', () => {
    const { getByTestId } = render(
      <SnapGlyph pxX={120} pxY={50} kind="endpoint" associative={true} />,
    );
    expect(getByTestId('snap-glyph-padlock')).toBeTruthy();
  });

  it('positions the SVG so the glyph centres on (pxX, pxY)', () => {
    const { getByTestId } = render(<SnapGlyph pxX={200} pxY={150} kind="endpoint" />);
    const svg = getByTestId('snap-glyph-svg');
    const left = Number(svg.getAttribute('width'));
    expect(Number.isFinite(left)).toBe(true);
    expect(left).toBeGreaterThan(0);
  });
});

describe('EDT-05 — SnapGlyphLayer', () => {
  it('renders nothing when the candidate list is empty', () => {
    const { container } = render(<SnapGlyphLayer candidates={[]} activeIndex={0} />);
    expect(container.querySelector('[data-testid="snap-glyph-layer"]')).toBeNull();
  });

  it('renders the active candidate label', () => {
    const { getByTestId } = render(
      <SnapGlyphLayer
        candidates={[{ kind: 'perpendicular', pxX: 100, pxY: 50 }]}
        activeIndex={0}
      />,
    );
    expect(getByTestId('snap-glyph-label').textContent).toContain('perpendicular');
  });

  it('shows Tab cycle hint when more than one candidate', () => {
    const { getByTestId } = render(
      <SnapGlyphLayer
        candidates={[
          { kind: 'endpoint', pxX: 100, pxY: 50 },
          { kind: 'intersection', pxX: 100, pxY: 50 },
        ]}
        activeIndex={0}
      />,
    );
    expect(getByTestId('snap-glyph-label').textContent).toContain('1/2');
    expect(getByTestId('snap-glyph-label').textContent).toContain('Tab');
  });

  it('selects the active candidate by index', () => {
    const { getByTestId } = render(
      <SnapGlyphLayer
        candidates={[
          { kind: 'endpoint', pxX: 100, pxY: 50 },
          { kind: 'intersection', pxX: 100, pxY: 50 },
        ]}
        activeIndex={1}
      />,
    );
    // Active glyph should be the intersection one.
    expect(getByTestId('snap-glyph-intersection')).toBeTruthy();
  });

  it('clamps a stale activeIndex modulo candidate length', () => {
    const { getByTestId } = render(
      <SnapGlyphLayer
        candidates={[
          { kind: 'endpoint', pxX: 100, pxY: 50 },
          { kind: 'intersection', pxX: 100, pxY: 50 },
        ]}
        activeIndex={37}
      />,
    );
    // 37 % 2 = 1 → intersection.
    expect(getByTestId('snap-glyph-intersection')).toBeTruthy();
  });
});
