import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { CanvasContextMenu } from './CanvasContextMenu';

afterEach(() => {
  cleanup();
});

describe('CanvasContextMenu — §1.7.1', () => {
  it('renders the context menu at given position', () => {
    const { getByTestId } = render(
      <CanvasContextMenu
        x={100}
        y={200}
        onClose={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomFit={() => {}}
      />,
    );
    expect(getByTestId('canvas-context-menu')).toBeTruthy();
  });

  it('renders zoom in, out, fit buttons', () => {
    const { getByTestId } = render(
      <CanvasContextMenu
        x={0}
        y={0}
        onClose={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomFit={() => {}}
      />,
    );
    expect(getByTestId('canvas-ctx-zoom-in')).toBeTruthy();
    expect(getByTestId('canvas-ctx-zoom-out')).toBeTruthy();
    expect(getByTestId('canvas-ctx-zoom-fit')).toBeTruthy();
  });

  it('clicking zoom in calls onZoomIn', () => {
    const onZoomIn = vi.fn();
    const { getByTestId } = render(
      <CanvasContextMenu
        x={0}
        y={0}
        onClose={() => {}}
        onZoomIn={onZoomIn}
        onZoomOut={() => {}}
        onZoomFit={() => {}}
      />,
    );
    fireEvent.click(getByTestId('canvas-ctx-zoom-in'));
    expect(onZoomIn).toHaveBeenCalled();
  });

  it('renders properties button when onProperties is provided', () => {
    const { getByTestId } = render(
      <CanvasContextMenu
        x={0}
        y={0}
        onClose={() => {}}
        onZoomIn={() => {}}
        onZoomOut={() => {}}
        onZoomFit={() => {}}
        onProperties={() => {}}
      />,
    );
    expect(getByTestId('canvas-ctx-properties')).toBeTruthy();
  });
});
