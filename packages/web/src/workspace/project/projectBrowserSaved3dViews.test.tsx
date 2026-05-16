import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import type { Saved3dViewElement } from '@bim-ai/core';
import { ProjectBrowserV3 } from './ProjectBrowser';

afterEach(() => {
  cleanup();
});

function makeSaved3dView(overrides: Partial<Saved3dViewElement> = {}): Element {
  return {
    kind: 'saved_3d_view',
    id: 's3v-01',
    name: 'Living Room View',
    cameraMm: { x: 1000, y: 2000, z: 3000 },
    targetMm: { x: 0, y: 0, z: 0 },
    locked: false,
    ...overrides,
  } as unknown as Element;
}

function makeDefaultProps(elements: Element[] = []) {
  return {
    elements,
    activeViewId: null as string | null,
    onActivateView: vi.fn(),
    onRenameView: vi.fn(),
    onDeleteView: vi.fn(),
    onDuplicateView: vi.fn(),
  };
}

describe('project browser 3D views — §6.1.3', () => {
  it('renders browser-save-3d-view button', () => {
    const { getByTestId } = render(<ProjectBrowserV3 {...makeDefaultProps()} />);
    expect(getByTestId('browser-save-3d-view')).toBeTruthy();
  });

  it('lists saved_3d_view elements by name', () => {
    const view1 = makeSaved3dView({ id: 's3v-a', name: 'Alpha View' });
    const view2 = makeSaved3dView({ id: 's3v-b', name: 'Beta View' });
    const { getByTestId } = render(<ProjectBrowserV3 {...makeDefaultProps([view1, view2])} />);
    expect(getByTestId('pb-3d-view-row-s3v-a')).toBeTruthy();
    expect(getByTestId('pb-3d-view-row-s3v-b')).toBeTruthy();
  });

  it('shows lock icon on locked views', () => {
    const lockedView = makeSaved3dView({ id: 's3v-locked', name: 'Locked View', locked: true });
    const { getByTestId } = render(<ProjectBrowserV3 {...makeDefaultProps([lockedView])} />);
    expect(getByTestId('pb-3d-lock-icon-s3v-locked')).toBeTruthy();
  });

  it('does not show lock icon on unlocked views', () => {
    const view = makeSaved3dView({ id: 's3v-open', name: 'Open View', locked: false });
    const { queryByTestId } = render(<ProjectBrowserV3 {...makeDefaultProps([view])} />);
    expect(queryByTestId('pb-3d-lock-icon-s3v-open')).toBeNull();
  });

  it('calls onSave3dView with the typed name when save button is clicked and name entered', () => {
    const onSave3dView = vi.fn();
    const { getByTestId } = render(
      <ProjectBrowserV3 {...makeDefaultProps()} onSave3dView={onSave3dView} />,
    );
    fireEvent.click(getByTestId('browser-save-3d-view'));
    const input = document.querySelector('input[placeholder="View name…"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    fireEvent.change(input, { target: { value: 'My New View' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave3dView).toHaveBeenCalledWith('My New View');
  });

  it('calls onRestore3dView on double-click of a saved_3d_view row', () => {
    const onRestore3dView = vi.fn();
    const view = makeSaved3dView({ id: 's3v-restore', name: 'Restore Me' });
    const { getByTestId } = render(
      <ProjectBrowserV3 {...makeDefaultProps([view])} onRestore3dView={onRestore3dView} />,
    );
    const btn = getByTestId('pb-3d-view-row-s3v-restore').querySelector('button') as HTMLElement;
    fireEvent.dblClick(btn);
    expect(onRestore3dView).toHaveBeenCalledWith('s3v-restore');
  });

  it('right-click on saved_3d_view row shows context menu with Restore/Rename/Delete/Lock', () => {
    const view = makeSaved3dView({ id: 's3v-ctx', name: 'Context Test' });
    const { getByTestId } = render(<ProjectBrowserV3 {...makeDefaultProps([view])} />);
    const btn = getByTestId('pb-3d-view-row-s3v-ctx').querySelector('button') as HTMLElement;
    fireEvent.contextMenu(btn, { clientX: 50, clientY: 50 });
    expect(getByTestId('pb-3d-ctx-restore')).toBeTruthy();
    expect(getByTestId('pb-3d-ctx-rename')).toBeTruthy();
    expect(getByTestId('pb-3d-ctx-delete')).toBeTruthy();
    expect(getByTestId('pb-3d-ctx-lock')).toBeTruthy();
  });

  it('context menu Lock calls onToggleLock3dView', () => {
    const onToggleLock3dView = vi.fn();
    const view = makeSaved3dView({ id: 's3v-lock', name: 'Lock Test' });
    const { getByTestId } = render(
      <ProjectBrowserV3 {...makeDefaultProps([view])} onToggleLock3dView={onToggleLock3dView} />,
    );
    const btn = getByTestId('pb-3d-view-row-s3v-lock').querySelector('button') as HTMLElement;
    fireEvent.contextMenu(btn, { clientX: 50, clientY: 50 });
    fireEvent.click(getByTestId('pb-3d-ctx-lock'));
    expect(onToggleLock3dView).toHaveBeenCalledWith('s3v-lock');
  });

  it('context menu Delete calls onDelete3dView', () => {
    const onDelete3dView = vi.fn();
    const view = makeSaved3dView({ id: 's3v-del', name: 'Delete Test' });
    const { getByTestId } = render(
      <ProjectBrowserV3 {...makeDefaultProps([view])} onDelete3dView={onDelete3dView} />,
    );
    const btn = getByTestId('pb-3d-view-row-s3v-del').querySelector('button') as HTMLElement;
    fireEvent.contextMenu(btn, { clientX: 50, clientY: 50 });
    fireEvent.click(getByTestId('pb-3d-ctx-delete'));
    expect(onDelete3dView).toHaveBeenCalledWith('s3v-del');
  });
});
