import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { CheatsheetModal } from './CheatsheetModal';

afterEach(() => {
  cleanup();
});

describe('<CheatsheetModal /> — spec §19', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = render(<CheatsheetModal open={false} onClose={() => undefined} />);
    expect(queryByTestId('cheatsheet-modal')).toBeNull();
  });

  it('renders the dialog when open with section labels', () => {
    const { getByText, getByTestId } = render(
      <CheatsheetModal open={true} onClose={() => undefined} />,
    );
    expect(getByTestId('cheatsheet-modal')).toBeTruthy();
    expect(getByText('Global')).toBeTruthy();
    expect(getByText('Workspace modes')).toBeTruthy();
    expect(getByText('Drawing tools')).toBeTruthy();
  });

  it('Escape closes the modal', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<CheatsheetModal open={true} onClose={onClose} />);
    fireEvent.keyDown(getByTestId('cheatsheet-modal'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the backdrop closes the modal', () => {
    const onClose = vi.fn();
    const { getByTestId } = render(<CheatsheetModal open={true} onClose={onClose} />);
    fireEvent.click(getByTestId('cheatsheet-modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('filter narrows the entry set', () => {
    const { getByLabelText, queryByText } = render(
      <CheatsheetModal open={true} onClose={() => undefined} />,
    );
    const search = getByLabelText('Filter shortcuts') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'orbit' } });
    expect(queryByText('Orbit')).not.toBeNull();
    // Random unrelated entry shouldn't survive.
    expect(queryByText('Confirm / Apply')).toBeNull();
  });

  it('Close button dispatches onClose', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<CheatsheetModal open={true} onClose={onClose} />);
    fireEvent.click(getByLabelText('Close cheatsheet'));
    expect(onClose).toHaveBeenCalled();
  });
});
