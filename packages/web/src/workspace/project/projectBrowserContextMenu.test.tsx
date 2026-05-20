/**
 * §1.6.11 — ProjectBrowser context menu on view nodes tests.
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

const viewpointEl: Element = {
  kind: 'viewpoint',
  id: 'vp-ctx-01',
  name: 'Main View',
  camera: {
    position: { xMm: 0, yMm: 0, zMm: 10000 },
    target: { xMm: 0, yMm: 0, zMm: 0 },
    up: { xMm: 0, yMm: 1, zMm: 0 },
  },
  mode: 'orbit_3d',
};

function makeProps(elements: Element[] = [viewpointEl]) {
  return {
    elements,
    activeViewId: null as string | null,
    onActivateView: vi.fn(),
    onRenameView: vi.fn(),
    onDeleteView: vi.fn(),
    onDuplicateView: vi.fn(),
  };
}

function getViewButton(container: HTMLElement, viewId: string): HTMLElement {
  const row = container.querySelector(`[data-testid="pb-view-row-${viewId}"]`);
  if (!row) throw new Error(`Could not find row for ${viewId}`);
  const btn = row.querySelector('button');
  if (!btn) throw new Error(`Could not find button in row for ${viewId}`);
  return btn as HTMLElement;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProjectBrowser context menu — §1.6.11', () => {
  it('right-click on view shows pb-context-menu', () => {
    const { container, queryByTestId } = render(<ProjectBrowserV3 {...makeProps()} />);
    expect(queryByTestId('pb-context-menu')).toBeNull();
    const btn = getViewButton(container, 'vp-ctx-01');
    fireEvent.contextMenu(btn, { clientX: 100, clientY: 200 });
    expect(queryByTestId('pb-context-menu')).not.toBeNull();
  });

  it('pb-ctx-rename shows rename input for the view', () => {
    const { container, getByTestId, queryByTestId } = render(<ProjectBrowserV3 {...makeProps()} />);
    const btn = getViewButton(container, 'vp-ctx-01');
    fireEvent.contextMenu(btn, { clientX: 100, clientY: 200 });
    expect(queryByTestId('pb-context-menu')).not.toBeNull();
    fireEvent.click(getByTestId('pb-ctx-rename'));
    // Context menu should be gone, rename input should be present
    expect(queryByTestId('pb-context-menu')).toBeNull();
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).not.toBeNull();
  });

  it('committing rename dispatches onRenameView with new name', () => {
    const props = makeProps();
    const { container, getByTestId } = render(<ProjectBrowserV3 {...props} />);
    const btn = getViewButton(container, 'vp-ctx-01');
    fireEvent.contextMenu(btn, { clientX: 0, clientY: 0 });
    fireEvent.click(getByTestId('pb-ctx-rename'));
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Renamed View' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(props.onRenameView).toHaveBeenCalledWith('vp-ctx-01', 'Renamed View');
  });

  it('pb-ctx-duplicate dispatches onDuplicateView with the view id', () => {
    const props = makeProps();
    const { container, getByTestId } = render(<ProjectBrowserV3 {...props} />);
    const btn = getViewButton(container, 'vp-ctx-01');
    fireEvent.contextMenu(btn, { clientX: 0, clientY: 0 });
    fireEvent.click(getByTestId('pb-ctx-duplicate'));
    expect(props.onDuplicateView).toHaveBeenCalledWith('vp-ctx-01');
  });

  it('pb-ctx-delete dispatches onDeleteView with the view id', () => {
    const props = makeProps();
    const { container, getByTestId } = render(<ProjectBrowserV3 {...props} />);
    const btn = getViewButton(container, 'vp-ctx-01');
    fireEvent.contextMenu(btn, { clientX: 0, clientY: 0 });
    fireEvent.click(getByTestId('pb-ctx-delete'));
    expect(props.onDeleteView).toHaveBeenCalledWith('vp-ctx-01');
  });

  it('context menu closes when clicking away (onClick on container)', () => {
    const { container, queryByTestId } = render(<ProjectBrowserV3 {...makeProps()} />);
    const btn = getViewButton(container, 'vp-ctx-01');
    fireEvent.contextMenu(btn, { clientX: 50, clientY: 50 });
    expect(queryByTestId('pb-context-menu')).not.toBeNull();
    // Click on the scrollable container to close
    const scrollArea = container.querySelector('[style*="overflow-y"]') as HTMLElement;
    if (scrollArea) fireEvent.click(scrollArea);
    expect(queryByTestId('pb-context-menu')).toBeNull();
  });

  it('right-click opens context menu with Rename / Duplicate / Delete buttons', () => {
    const { container, getByTestId } = render(<ProjectBrowserV3 {...makeProps()} />);
    const btn = getViewButton(container, 'vp-ctx-01');
    fireEvent.contextMenu(btn, { clientX: 0, clientY: 0 });
    expect(getByTestId('pb-ctx-rename')).toBeTruthy();
    expect(getByTestId('pb-ctx-duplicate')).toBeTruthy();
    expect(getByTestId('pb-ctx-delete')).toBeTruthy();
  });
});
