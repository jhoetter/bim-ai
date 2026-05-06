import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { CheatsheetModal } from './CheatsheetModal';
import i18n from '../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(<I18nextProvider i18n={i18n}>{ui}</I18nextProvider>);
}

afterEach(() => {
  cleanup();
});

describe('<CheatsheetModal /> — spec §19', () => {
  it('renders nothing when closed', () => {
    const { queryByTestId } = renderWithI18n(<CheatsheetModal open={false} onClose={() => undefined} />);
    expect(queryByTestId('cheatsheet-modal')).toBeNull();
  });

  it('renders the dialog when open with section labels', () => {
    const { getByText, getByTestId } = renderWithI18n(
      <CheatsheetModal open={true} onClose={() => undefined} />,
    );
    expect(getByTestId('cheatsheet-modal')).toBeTruthy();
    expect(getByText('Global')).toBeTruthy();
    expect(getByText('Workspace modes')).toBeTruthy();
    expect(getByText('Drawing tools')).toBeTruthy();
  });

  it('Escape closes the modal', () => {
    const onClose = vi.fn();
    const { getByTestId } = renderWithI18n(<CheatsheetModal open={true} onClose={onClose} />);
    fireEvent.keyDown(getByTestId('cheatsheet-modal'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking the backdrop closes the modal', () => {
    const onClose = vi.fn();
    const { getByTestId } = renderWithI18n(<CheatsheetModal open={true} onClose={onClose} />);
    fireEvent.click(getByTestId('cheatsheet-modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('filter narrows the entry set', () => {
    const { getByLabelText, queryByText } = renderWithI18n(
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
    const { getByLabelText } = renderWithI18n(<CheatsheetModal open={true} onClose={onClose} />);
    fireEvent.click(getByLabelText('Close cheatsheet'));
    expect(onClose).toHaveBeenCalled();
  });
});
