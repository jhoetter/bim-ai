import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Element } from '@bim-ai/core';

import { ProjectInfoDialog } from './ProjectInfoDialog';

afterEach(() => {
  cleanup();
});

function makeProjectSettings(overrides: Record<string, unknown> = {}): Element {
  return {
    kind: 'project_settings',
    id: 'project_settings',
    name: 'My Project',
    projectNumber: 'PRJ-001',
    clientName: 'ACME Corp',
    projectStatus: 'Active',
    authorName: 'Jane Doe',
    issueDate: '2026-01-15',
    checkDate: 'John Smith',
    projectDescription: 'A test project',
    projectAddress: '123 Main St',
    ...overrides,
  } as unknown as Element;
}

const baseElements: Record<string, Element> = {
  project_settings: makeProjectSettings(),
};

describe('ProjectInfoDialog', () => {
  it('returns null when closed', () => {
    const { container } = render(
      <ProjectInfoDialog
        open={false}
        onClose={vi.fn()}
        elementsById={baseElements}
        onSemanticCommand={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('populates fields from project_settings on open', () => {
    render(
      <ProjectInfoDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements}
        onSemanticCommand={vi.fn()}
      />,
    );
    expect((screen.getByTestId('project-info-name') as HTMLInputElement).value).toBe('My Project');
    expect((screen.getByTestId('project-info-number') as HTMLInputElement).value).toBe('PRJ-001');
    expect((screen.getByTestId('project-info-client') as HTMLInputElement).value).toBe('ACME Corp');
    expect((screen.getByTestId('project-info-author') as HTMLInputElement).value).toBe('Jane Doe');
    expect((screen.getByTestId('project-info-issuedate') as HTMLInputElement).value).toBe(
      '2026-01-15',
    );
  });

  it('dispatches updateElementProperty commands for each field on save', async () => {
    const dispatch = vi.fn();
    render(
      <ProjectInfoDialog
        open
        onClose={vi.fn()}
        elementsById={baseElements}
        onSemanticCommand={dispatch}
      />,
    );
    fireEvent.change(screen.getByTestId('project-info-name'), {
      target: { value: 'New Name' },
    });
    fireEvent.click(screen.getByTestId('project-info-save'));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const calls = dispatch.mock.calls.map((c) => c[0] as Record<string, unknown>);
    const nameCmd = calls.find((c) => c.key === 'name');
    expect(nameCmd).toBeDefined();
    expect(nameCmd?.type).toBe('updateElementProperty');
    expect(nameCmd?.value).toBe('New Name');
    expect(nameCmd?.elementId).toBe('project_settings');
  });

  it('closes on Escape key', () => {
    const onClose = vi.fn();
    render(
      <ProjectInfoDialog
        open
        onClose={onClose}
        elementsById={baseElements}
        onSemanticCommand={vi.fn()}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('works with empty elementsById (no project settings yet)', async () => {
    const dispatch = vi.fn();
    render(
      <ProjectInfoDialog open onClose={vi.fn()} elementsById={{}} onSemanticCommand={dispatch} />,
    );
    expect((screen.getByTestId('project-info-name') as HTMLInputElement).value).toBe('');
    fireEvent.change(screen.getByTestId('project-info-name'), { target: { value: 'Brand New' } });
    fireEvent.click(screen.getByTestId('project-info-save'));
    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    const firstCmd = dispatch.mock.calls[0][0] as Record<string, unknown>;
    expect(firstCmd.type).toBe('upsertProjectSettings');
  });
});
