import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Element } from '@bim-ai/core';

import { ProjectInfoDialog } from './project/ProjectInfoDialog';

afterEach(() => {
  cleanup();
});

function makeElements(overrides: Record<string, unknown> = {}): Record<string, Element> {
  return {
    project_settings: {
      kind: 'project_settings',
      id: 'project_settings',
      name: 'Test Project',
      projectNumber: 'TP-2026',
      clientName: 'ACME Corp',
      projectAddress: '123 Main St\nCity, 12345',
      projectStatus: 'Design Development',
      authorName: 'Jane Doe',
      issueDate: '2026-05-16',
      checkDate: '2026-05-10',
      projectDescription: 'A BIM project',
      ...overrides,
    } as unknown as Element,
  };
}

describe('project information dialog — §2.1.1', () => {
  it('renders project-info-name input with current project name', () => {
    render(
      <ProjectInfoDialog
        open
        onClose={vi.fn()}
        elementsById={makeElements()}
        onSemanticCommand={vi.fn()}
      />,
    );
    const input = screen.getByTestId('project-info-name') as HTMLInputElement;
    expect(input.value).toBe('Test Project');
  });

  it('renders project-info-number input', () => {
    render(
      <ProjectInfoDialog
        open
        onClose={vi.fn()}
        elementsById={makeElements()}
        onSemanticCommand={vi.fn()}
      />,
    );
    const input = screen.getByTestId('project-info-number') as HTMLInputElement;
    expect(input.value).toBe('TP-2026');
  });

  it('name input change + save dispatches updateElementProperty for name', async () => {
    const dispatch = vi.fn();
    render(
      <ProjectInfoDialog
        open
        onClose={vi.fn()}
        elementsById={makeElements()}
        onSemanticCommand={dispatch}
      />,
    );
    fireEvent.change(screen.getByTestId('project-info-name'), {
      target: { value: 'Renamed Project' },
    });
    fireEvent.click(screen.getByTestId('project-info-save'));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const calls = dispatch.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const nameCmd = calls.find((c) => c.key === 'name');
    expect(nameCmd?.type).toBe('updateElementProperty');
    expect(nameCmd?.value).toBe('Renamed Project');
  });

  it('project-info-close button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <ProjectInfoDialog
        open
        onClose={onClose}
        elementsById={makeElements()}
        onSemanticCommand={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByTestId('project-info-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders project-info-address textarea', () => {
    render(
      <ProjectInfoDialog
        open
        onClose={vi.fn()}
        elementsById={makeElements()}
        onSemanticCommand={vi.fn()}
      />,
    );
    const textarea = screen.getByTestId('project-info-address') as HTMLTextAreaElement;
    expect(textarea.tagName.toLowerCase()).toBe('textarea');
    expect(textarea.value).toBe('123 Main St\nCity, 12345');
  });
});
