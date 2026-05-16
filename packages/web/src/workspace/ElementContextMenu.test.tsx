import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';

import { ElementContextMenu } from './ElementContextMenu';
import type { ContextMenuItem } from './ElementContextMenu';

afterEach(() => {
  cleanup();
});

const baseItems: ContextMenuItem[] = [
  { label: 'Flip Facing', onClick: vi.fn() },
  { label: 'Flip Handing', onClick: vi.fn() },
  { label: '', separator: true, onClick: vi.fn() },
  { label: 'Delete', onClick: vi.fn() },
];

describe('ElementContextMenu — §1.7.2', () => {
  it('renders items with data-testid ctx-item-{label}', () => {
    const { getByTestId } = render(
      <ElementContextMenu
        open
        anchorX={100}
        anchorY={200}
        items={baseItems}
        onClose={vi.fn()}
        data-testid="ctx-menu"
      />,
    );
    expect(getByTestId('ctx-item-flip-facing')).toBeTruthy();
    expect(getByTestId('ctx-item-flip-handing')).toBeTruthy();
    expect(getByTestId('ctx-item-delete')).toBeTruthy();
  });

  it('returns null when open=false', () => {
    const { container } = render(
      <ElementContextMenu
        open={false}
        anchorX={100}
        anchorY={200}
        items={baseItems}
        onClose={vi.fn()}
        data-testid="ctx-menu"
      />,
    );
    expect(container.querySelector('[data-testid="ctx-menu"]')).toBeNull();
  });

  it('clicking an item calls its onClick and closes', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    const items: ContextMenuItem[] = [{ label: 'Flip Facing', onClick }];
    const { getByTestId } = render(
      <ElementContextMenu
        open
        anchorX={100}
        anchorY={200}
        items={items}
        onClose={onClose}
        data-testid="ctx-menu"
      />,
    );
    fireEvent.click(getByTestId('ctx-item-flip-facing'));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders separator as hr element', () => {
    const { container } = render(
      <ElementContextMenu
        open
        anchorX={100}
        anchorY={200}
        items={baseItems}
        onClose={vi.fn()}
        data-testid="ctx-menu"
      />,
    );
    expect(container.querySelector('hr')).toBeTruthy();
  });

  it('Escape key closes the menu', () => {
    const onClose = vi.fn();
    render(
      <ElementContextMenu
        open
        anchorX={100}
        anchorY={200}
        items={baseItems}
        onClose={onClose}
        data-testid="ctx-menu"
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking outside closes the menu', () => {
    const onClose = vi.fn();
    render(
      <div>
        <button type="button" data-testid="outside">
          outside
        </button>
        <ElementContextMenu
          open
          anchorX={100}
          anchorY={200}
          items={baseItems}
          onClose={onClose}
          data-testid="ctx-menu"
        />
      </div>,
    );
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  it('positions the menu at anchorX, anchorY', () => {
    const { getByTestId } = render(
      <ElementContextMenu
        open
        anchorX={150}
        anchorY={300}
        items={[{ label: 'Delete', onClick: vi.fn() }]}
        onClose={vi.fn()}
        data-testid="ctx-menu"
      />,
    );
    const menu = getByTestId('ctx-menu');
    expect(menu.style.left).toBe('150px');
    expect(menu.style.top).toBe('300px');
  });
});
