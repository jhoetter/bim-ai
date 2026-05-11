import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { CommentsPanel } from './CommentsPanel';
import type { UxComment } from '../../state/store';
import i18n from '../../i18n';

function renderWithI18n(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => <I18nextProvider i18n={i18n}>{children}</I18nextProvider>,
  });
}

afterEach(() => {
  cleanup();
});

const noopPost = vi.fn().mockResolvedValue(undefined);
const noopResolve = vi.fn().mockResolvedValue(undefined);
const noopClose = vi.fn();

const SAMPLE_COMMENTS: UxComment[] = [
  {
    id: 'c1',
    userDisplay: 'Alice',
    body: 'Check this wall thickness.',
    resolved: false,
    createdAt: '2026-01-01T10:00:00Z',
  },
  {
    id: 'c2',
    userDisplay: 'Bob',
    body: 'Resolved already.',
    resolved: true,
    createdAt: '2026-01-02T10:00:00Z',
  },
];

describe('CommentsPanel', () => {
  it('renders the panel heading and close button', () => {
    const { getByTestId, getByText, getByLabelText } = renderWithI18n(
      <CommentsPanel
        comments={[]}
        userDisplay="Alice"
        onPost={noopPost}
        onResolve={noopResolve}
        onClose={noopClose}
      />,
    );
    expect(getByTestId('comments-panel')).toBeTruthy();
    expect(getByText('Comments')).toBeTruthy();
    expect(getByLabelText('Close comments')).toBeTruthy();
  });

  it('shows "No comments yet." when list is empty', () => {
    const { getByTestId } = renderWithI18n(
      <CommentsPanel
        comments={[]}
        userDisplay="Alice"
        onPost={noopPost}
        onResolve={noopResolve}
        onClose={noopClose}
      />,
    );
    expect(getByTestId('comments-list').textContent).toContain('No comments yet.');
  });

  it('surfaces a discipline scope note without blocking comment posting', () => {
    const { getByTestId } = renderWithI18n(
      <CommentsPanel
        comments={[]}
        userDisplay="Alice"
        outsideScopeNote="This element is outside your discipline scope."
        onPost={noopPost}
        onResolve={noopResolve}
        onClose={noopClose}
      />,
    );
    expect(getByTestId('comment-discipline-scope-note').textContent).toContain(
      'outside your discipline scope',
    );
  });

  it('renders comment entries with userDisplay + body', () => {
    const { getByText } = renderWithI18n(
      <CommentsPanel
        comments={SAMPLE_COMMENTS}
        userDisplay="Alice"
        onPost={noopPost}
        onResolve={noopResolve}
        onClose={noopClose}
      />,
    );
    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('Check this wall thickness.')).toBeTruthy();
    expect(getByText('Bob')).toBeTruthy();
  });

  it('shows Resolve button for open comments and Reopen for resolved', () => {
    const { getAllByTestId } = renderWithI18n(
      <CommentsPanel
        comments={SAMPLE_COMMENTS}
        userDisplay="Alice"
        onPost={noopPost}
        onResolve={noopResolve}
        onClose={noopClose}
      />,
    );
    expect(getAllByTestId('comment-resolve')).toHaveLength(1);
    expect(getAllByTestId('comment-reopen')).toHaveLength(1);
  });

  it('calls onResolve with toggled state when Resolve clicked', async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const { getAllByTestId } = renderWithI18n(
      <CommentsPanel
        comments={SAMPLE_COMMENTS}
        userDisplay="Alice"
        onPost={noopPost}
        onResolve={onResolve}
        onClose={noopClose}
      />,
    );
    fireEvent.click(getAllByTestId('comment-resolve')[0]!);
    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith('c1', true);
    });
  });

  it('calls onResolve with false when Reopen is clicked', async () => {
    const onResolve = vi.fn().mockResolvedValue(undefined);
    const { getAllByTestId } = renderWithI18n(
      <CommentsPanel
        comments={SAMPLE_COMMENTS}
        userDisplay="Bob"
        onPost={noopPost}
        onResolve={onResolve}
        onClose={noopClose}
      />,
    );
    fireEvent.click(getAllByTestId('comment-reopen')[0]!);
    await waitFor(() => {
      expect(onResolve).toHaveBeenCalledWith('c2', false);
    });
  });

  it('calls onPost with trimmed text and clears input', async () => {
    const onPost = vi.fn().mockResolvedValue(undefined);
    const { getByTestId } = renderWithI18n(
      <CommentsPanel
        comments={[]}
        userDisplay="Alice"
        onPost={onPost}
        onResolve={noopResolve}
        onClose={noopClose}
      />,
    );
    const input = getByTestId('comment-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: '  Hello world  ' } });
    fireEvent.click(getByTestId('comment-post-btn'));
    await waitFor(() => {
      expect(onPost).toHaveBeenCalledWith('Hello world');
      expect(input.value).toBe('');
    });
  });

  it('Post button is disabled when input is empty', () => {
    const { getByTestId } = renderWithI18n(
      <CommentsPanel
        comments={[]}
        userDisplay="Alice"
        onPost={noopPost}
        onResolve={noopResolve}
        onClose={noopClose}
      />,
    );
    expect((getByTestId('comment-post-btn') as HTMLButtonElement).disabled).toBe(true);
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const { getByLabelText } = renderWithI18n(
      <CommentsPanel
        comments={[]}
        userDisplay="Alice"
        onPost={noopPost}
        onResolve={noopResolve}
        onClose={onClose}
      />,
    );
    fireEvent.click(getByLabelText('Close comments'));
    expect(onClose).toHaveBeenCalled();
  });
});
