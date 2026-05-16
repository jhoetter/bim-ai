/**
 * D6 — Sheet Revision Management tests.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import type { Element } from '@bim-ai/core';
import { ManageRevisionsDialog } from './ManageRevisionsDialog';

afterEach(cleanup);

const rev1: Extract<Element, { kind: 'revision' }> = {
  kind: 'revision',
  id: 'rev-01',
  number: '01',
  date: '2026-05-16',
  description: 'Issued for Review',
  issuedBy: 'Architect',
  issuedTo: 'Client',
};

const rev2: Extract<Element, { kind: 'revision' }> = {
  kind: 'revision',
  id: 'rev-02',
  number: '02',
  date: '2026-06-01',
  description: 'Issued for Construction',
};

const sheetRev1: Extract<Element, { kind: 'sheet_revision' }> = {
  kind: 'sheet_revision',
  id: 'sr-01',
  sheetId: 'sheet-A101',
  revisionId: 'rev-01',
};

function makeProps(overrides: Partial<Parameters<typeof ManageRevisionsDialog>[0]> = {}) {
  return {
    isOpen: true,
    revisions: [rev1, rev2],
    sheetRevisions: [],
    activeSheetId: null,
    onCreateRevision: vi.fn(),
    onUpdateRevision: vi.fn(),
    onDeleteRevision: vi.fn(),
    onAddSheetRevision: vi.fn(),
    onRemoveSheetRevision: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

describe('ManageRevisionsDialog — D6', () => {
  it('renders nothing when isOpen=false', () => {
    const { queryByTestId } = render(<ManageRevisionsDialog {...makeProps({ isOpen: false })} />);
    expect(queryByTestId('manage-revisions-dialog')).toBeNull();
  });

  it('shows the revision table with existing rows', () => {
    const { getByTestId } = render(<ManageRevisionsDialog {...makeProps()} />);
    expect(getByTestId('manage-revisions-table')).toBeTruthy();
    expect(getByTestId('revision-row-rev-01')).toBeTruthy();
    expect(getByTestId('revision-row-rev-02')).toBeTruthy();
  });

  it('calls onCreateRevision with correct fields when Add Revision is clicked', () => {
    const onCreateRevision = vi.fn();
    const { getByTestId } = render(<ManageRevisionsDialog {...makeProps({ onCreateRevision })} />);
    fireEvent.change(getByTestId('revision-new-number'), { target: { value: '03' } });
    fireEvent.change(getByTestId('revision-new-date'), { target: { value: '2026-07-01' } });
    fireEvent.change(getByTestId('revision-new-description'), {
      target: { value: 'Coordinated' },
    });
    fireEvent.click(getByTestId('revision-add-btn'));
    expect(onCreateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        number: '03',
        date: '2026-07-01',
        description: 'Coordinated',
      }),
    );
  });

  it('does not call onCreateRevision when required fields are empty', () => {
    const onCreateRevision = vi.fn();
    const { getByTestId } = render(<ManageRevisionsDialog {...makeProps({ onCreateRevision })} />);
    fireEvent.click(getByTestId('revision-add-btn'));
    expect(onCreateRevision).not.toHaveBeenCalled();
  });

  it('calls onDeleteRevision with revision id', () => {
    const onDeleteRevision = vi.fn();
    const { getByTestId } = render(<ManageRevisionsDialog {...makeProps({ onDeleteRevision })} />);
    fireEvent.click(getByTestId('revision-delete-rev-01'));
    expect(onDeleteRevision).toHaveBeenCalledWith('rev-01');
  });

  it('shows inline edit fields when Edit is clicked', () => {
    const { getByTestId } = render(<ManageRevisionsDialog {...makeProps()} />);
    fireEvent.click(getByTestId('revision-edit-rev-01'));
    expect(getByTestId('revision-edit-number-rev-01')).toBeTruthy();
    expect(getByTestId('revision-edit-description-rev-01')).toBeTruthy();
  });

  it('calls onUpdateRevision with updated fields on save', () => {
    const onUpdateRevision = vi.fn();
    const { getByTestId } = render(<ManageRevisionsDialog {...makeProps({ onUpdateRevision })} />);
    fireEvent.click(getByTestId('revision-edit-rev-01'));
    fireEvent.change(getByTestId('revision-edit-description-rev-01'), {
      target: { value: 'Issued for Construction' },
    });
    fireEvent.click(getByTestId('revision-save-rev-01'));
    expect(onUpdateRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'rev-01',
        description: 'Issued for Construction',
      }),
    );
  });

  it('shows "On Sheet" checkboxes when activeSheetId is provided', () => {
    const { getByTestId } = render(
      <ManageRevisionsDialog
        {...makeProps({
          activeSheetId: 'sheet-A101',
          sheetRevisions: [sheetRev1],
        })}
      />,
    );
    const row = getByTestId('revision-row-rev-01');
    const checkbox = within(row).getByTestId('revision-on-sheet-rev-01') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    const row2 = getByTestId('revision-row-rev-02');
    const checkbox2 = within(row2).getByTestId('revision-on-sheet-rev-02') as HTMLInputElement;
    expect(checkbox2.checked).toBe(false);
  });

  it('calls onAddSheetRevision when unchecked revision is toggled on', () => {
    const onAddSheetRevision = vi.fn();
    const { getByTestId } = render(
      <ManageRevisionsDialog
        {...makeProps({
          activeSheetId: 'sheet-A101',
          sheetRevisions: [],
          onAddSheetRevision,
        })}
      />,
    );
    const row = getByTestId('revision-row-rev-02');
    fireEvent.click(within(row).getByTestId('revision-on-sheet-rev-02'));
    expect(onAddSheetRevision).toHaveBeenCalledWith(
      expect.objectContaining({
        sheetId: 'sheet-A101',
        revisionId: 'rev-02',
      }),
    );
  });

  it('calls onRemoveSheetRevision when checked revision is toggled off', () => {
    const onRemoveSheetRevision = vi.fn();
    const { getByTestId } = render(
      <ManageRevisionsDialog
        {...makeProps({
          activeSheetId: 'sheet-A101',
          sheetRevisions: [sheetRev1],
          onRemoveSheetRevision,
        })}
      />,
    );
    const row = getByTestId('revision-row-rev-01');
    fireEvent.click(within(row).getByTestId('revision-on-sheet-rev-01'));
    expect(onRemoveSheetRevision).toHaveBeenCalledWith('sr-01');
  });

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<ManageRevisionsDialog {...makeProps({ onClose })} />);
    fireEvent.click(getByTestId('manage-revisions-close'));
    expect(onClose).toHaveBeenCalled();
  });
});
