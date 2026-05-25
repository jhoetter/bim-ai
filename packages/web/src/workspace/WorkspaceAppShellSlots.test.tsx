/**
 * Issue #124 — MF-render-11. The Playwright capture runner watches for the
 * `data-bim-model-status` / `data-bim-loading` attributes on the canvas root
 * to know when the geometry stream has settled and an ortho screenshot will
 * not catch the "Loading model…" overlay. These tests pin those attributes
 * to the value of the `modelReady` prop so the contract with external view
 * capture runners cannot regress silently.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { JSX } from 'react';

import { WorkspaceCanvasSlot, type WorkspaceCanvasSlotProps } from './WorkspaceAppShellSlots';

// Stub heavy / WebGL-bound imports so the slot can render in jsdom without
// pulling in the full Three.js + Viewport graph (the BVH module crashes on
// import in this environment because the build resolves three twice).
vi.mock('./viewport', () => ({
  canvasContainerStyle: { position: 'relative' as const, inset: 0 },
}));
vi.mock('./QuickAccessToolbar', () => ({
  QuickAccessToolbar: () => <div data-testid="stub-qat" />,
}));
vi.mock('./WorkspaceHelpers', () => ({
  EmptyStateOverlay: ({ headline }: { headline: string }) => (
    <div data-testid="stub-empty-state">{headline}</div>
  ),
}));
vi.mock('./shell', () => ({
  EmptyStateHint: () => <div data-testid="stub-empty-state-hint" />,
  ParticipantStrip: () => null,
  StatusBar: () => null,
}));
vi.mock('./shell/DegradedModeBadge', () => ({
  DegradedModeBadge: () => null,
}));
vi.mock('./compositions', () => ({
  CompositionBar: () => null,
}));

afterEach(() => {
  cleanup();
});

function renderSlot(override: Partial<WorkspaceCanvasSlotProps> = {}): {
  root: HTMLElement;
} {
  const baseProps: WorkspaceCanvasSlotProps = {
    activeViewKind: '3d',
    showEmptyStateOverlay: false,
    showCanvasHint: false,
    emptyHint: { headline: 'Loading model…', hint: 'Streaming geometry from the engine.' },
    seedLoading: false,
    seedError: null,
    modelReady: true,
    onInsertSeedHouse: () => {},
    paneRoot: { kind: 'leaf', id: 'root', tabId: null },
    renderPaneNode: (): JSX.Element => <div data-testid="stub-pane" />,
    onSemanticCommand: () => {},
  };
  const { getByTestId } = render(<WorkspaceCanvasSlot {...baseProps} {...override} />);
  return { root: getByTestId('redesign-canvas-root') as HTMLElement };
}

describe('WorkspaceCanvasSlot — capture runner contract (issue #124)', () => {
  it('marks the canvas root data-evidence-capture-root="true"', () => {
    const { root } = renderSlot();
    expect(root.getAttribute('data-evidence-capture-root')).toBe('true');
  });

  it('emits data-bim-model-status="ready" when modelReady is true', () => {
    const { root } = renderSlot({ modelReady: true });
    expect(root.getAttribute('data-bim-model-status')).toBe('ready');
    expect(root.hasAttribute('data-bim-loading')).toBe(false);
  });

  it('emits data-bim-model-status="loading" + data-bim-loading="true" while geometry is streaming', () => {
    const { root } = renderSlot({ modelReady: false, seedLoading: true });
    expect(root.getAttribute('data-bim-model-status')).toBe('loading');
    expect(root.getAttribute('data-bim-loading')).toBe('true');
  });

  it('keeps the loading marker even when seedLoading is false but no geometry yet', () => {
    // E.g. a fresh empty session — the runner still must not race the first
    // ortho capture against an unhydrated viewport.
    const { root } = renderSlot({ modelReady: false, seedLoading: false });
    expect(root.getAttribute('data-bim-model-status')).toBe('loading');
    expect(root.getAttribute('data-bim-loading')).toBe('true');
  });
});
