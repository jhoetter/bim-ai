import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useBimStore } from '../state/store';
import { ProjectTemplatesDialog } from './ProjectTemplatesDialog';

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  localStorage.removeItem('bim-ai-templates');
  useBimStore.setState({ projectTemplates: [], elementsById: {} });
});

describe('ProjectTemplates — §1.6.2', () => {
  it('renders dialog with empty state', () => {
    render(<ProjectTemplatesDialog onClose={() => {}} />);
    expect(screen.getByTestId('project-templates-dialog')).toBeTruthy();
    expect(screen.getByTestId('template-empty-state')).toBeTruthy();
  });

  it('save button is disabled when name is empty', () => {
    render(<ProjectTemplatesDialog onClose={() => {}} />);
    const btn = screen.getByTestId('template-save-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('saves a template when name is provided', () => {
    render(<ProjectTemplatesDialog onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('template-name-input'), {
      target: { value: 'My Template' },
    });
    fireEvent.click(screen.getByTestId('template-save-btn'));
    expect(useBimStore.getState().projectTemplates).toHaveLength(1);
    expect(useBimStore.getState().projectTemplates[0].name).toBe('My Template');
  });

  it('deletes a template', () => {
    useBimStore.getState().saveProjectAsTemplate('T1', '');
    const tplId = useBimStore.getState().projectTemplates[0].id;
    render(<ProjectTemplatesDialog onClose={() => {}} />);
    fireEvent.click(screen.getByTestId(`template-delete-${tplId}`));
    expect(useBimStore.getState().projectTemplates).toHaveLength(0);
  });

  it('loads a template and closes', () => {
    useBimStore.getState().saveProjectAsTemplate('T1', '');
    const tplId = useBimStore.getState().projectTemplates[0].id;
    const onClose = vi.fn();
    render(<ProjectTemplatesDialog onClose={onClose} />);
    fireEvent.click(screen.getByTestId(`template-load-${tplId}`));
    expect(onClose).toHaveBeenCalled();
  });

  it('persists templates to localStorage', () => {
    useBimStore.getState().saveProjectAsTemplate('Saved', 'desc');
    const stored = JSON.parse(localStorage.getItem('bim-ai-templates') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Saved');
  });
});
