import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';

afterEach(() => {
  cleanup();
});

const baseProps = {
  activeWorkspaceId: 'arch' as const,
  userPreferredWorkspace: 'arch' as const,
  onSetActiveWorkspace: vi.fn(),
};

describe('WorkspaceSwitcher — CHR-V3-02', () => {
  it('chip renders with data-disc="arch" and label "Architekt" when activeWorkspaceId="arch"', () => {
    const { getByTestId } = render(<WorkspaceSwitcher {...baseProps} />);
    const chip = getByTestId('workspace-switcher-chip');
    expect(chip.getAttribute('data-disc')).toBe('arch');
    expect(chip.textContent).toContain('Architekt');
  });

  it('chip renders with data-disc="struct" and label "Statiker" when activeWorkspaceId="struct"', () => {
    const { getByTestId } = render(
      <WorkspaceSwitcher
        {...baseProps}
        activeWorkspaceId="struct"
        userPreferredWorkspace="struct"
      />,
    );
    const chip = getByTestId('workspace-switcher-chip');
    expect(chip.getAttribute('data-disc')).toBe('struct');
    expect(chip.textContent).toContain('Statiker');
  });

  it('click chip → aria-expanded="true", listbox appears with 4 option rows', () => {
    const { getByTestId, getAllByRole } = render(<WorkspaceSwitcher {...baseProps} />);
    const chip = getByTestId('workspace-switcher-chip');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    const options = getAllByRole('option');
    expect(options).toHaveLength(4);
  });

  it('click "Statiker" row → onSetActiveWorkspace("struct") called once', () => {
    const onSetActiveWorkspace = vi.fn();
    const { getByTestId } = render(
      <WorkspaceSwitcher {...baseProps} onSetActiveWorkspace={onSetActiveWorkspace} />,
    );
    fireEvent.click(getByTestId('workspace-switcher-chip'));
    fireEvent.click(getByTestId('workspace-option-struct'));
    expect(onSetActiveWorkspace).toHaveBeenCalledTimes(1);
    expect(onSetActiveWorkspace).toHaveBeenCalledWith('struct');
  });

  it('after selection, aria-expanded="false" and listbox closes', () => {
    const { getByTestId, queryByRole } = render(
      <WorkspaceSwitcher {...baseProps} onSetActiveWorkspace={vi.fn()} />,
    );
    const chip = getByTestId('workspace-switcher-chip');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(getByTestId('workspace-option-struct'));
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(queryByRole('listbox')).toBeNull();
  });

  it('Escape key closes the open listbox', () => {
    const { getByTestId, queryByRole } = render(<WorkspaceSwitcher {...baseProps} />);
    const chip = getByTestId('workspace-switcher-chip');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(queryByRole('listbox')).toBeNull();
  });

  it('mousedown outside closes the open listbox', () => {
    const { getByTestId, queryByRole } = render(<WorkspaceSwitcher {...baseProps} />);
    const chip = getByTestId('workspace-switcher-chip');
    fireEvent.click(chip);
    expect(chip.getAttribute('aria-expanded')).toBe('true');
    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(chip.getAttribute('aria-expanded')).toBe('false');
    expect(queryByRole('listbox')).toBeNull();
  });

  it('CON-V3-03 Concept row is present and selectable', () => {
    const onSetActiveWorkspace = vi.fn();
    const { getByTestId } = render(<WorkspaceSwitcher {...baseProps} />);
    fireEvent.click(getByTestId('workspace-switcher-chip'));
    const conceptRow = getByTestId('workspace-option-concept');
    expect(conceptRow).not.toBeNull();
    expect(conceptRow.getAttribute('aria-disabled')).toBeNull();
    cleanup();

    const rendered = render(
      <WorkspaceSwitcher {...baseProps} onSetActiveWorkspace={onSetActiveWorkspace} />,
    );
    fireEvent.click(rendered.getByTestId('workspace-switcher-chip'));
    fireEvent.click(rendered.getByTestId('workspace-option-concept'));
    expect(onSetActiveWorkspace).toHaveBeenCalledWith('concept');
  });

  it('CON-V3-03 chip renders Concept when activeWorkspaceId="concept"', () => {
    const { getByTestId } = render(
      <WorkspaceSwitcher
        {...baseProps}
        activeWorkspaceId="concept"
        userPreferredWorkspace="concept"
      />,
    );
    const chip = getByTestId('workspace-switcher-chip');
    expect(chip.getAttribute('data-disc')).toBe('concept');
    expect(chip.textContent).toContain('Concept');
  });

  it('data-testid="workspace-option-arch" is present in the open menu', () => {
    const { getByTestId } = render(<WorkspaceSwitcher {...baseProps} />);
    fireEvent.click(getByTestId('workspace-switcher-chip'));
    expect(getByTestId('workspace-option-arch')).not.toBeNull();
  });

  it('workspace-option-struct carries aria-selected="false" when arch is active', () => {
    const { getByTestId } = render(<WorkspaceSwitcher {...baseProps} activeWorkspaceId="arch" />);
    fireEvent.click(getByTestId('workspace-switcher-chip'));
    const structRow = getByTestId('workspace-option-struct');
    expect(structRow.getAttribute('aria-selected')).toBe('false');
  });

  it('no inline style attribute on chip or menu rows contains a # hex literal', () => {
    const { getByTestId, container } = render(<WorkspaceSwitcher {...baseProps} />);
    fireEvent.click(getByTestId('workspace-switcher-chip'));

    const styledEls = Array.from(container.querySelectorAll('[style]'));
    const hexPattern = /#[0-9a-fA-F]{3,6}\b/;
    for (const el of styledEls) {
      const cssText = el.getAttribute('style') ?? '';
      expect(
        hexPattern.test(cssText),
        `Element ${el.getAttribute('data-testid') ?? el.tagName} has hex literal in style: "${cssText}"`,
      ).toBe(false);
    }
  });
});
