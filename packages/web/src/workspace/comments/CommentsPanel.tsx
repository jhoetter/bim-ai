import { useState, type JSX } from 'react';
import { useTranslation } from 'react-i18next';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import type { UxComment } from '../../state/store';

export interface CommentsPanelProps {
  comments: UxComment[];
  userDisplay: string;
  onPost: (body: string) => Promise<void>;
  onResolve: (commentId: string, resolved: boolean) => Promise<void>;
  onClose: () => void;
  outsideScopeNote?: string | null;
}

export function CommentsPanel({
  comments,
  userDisplay: _userDisplay,
  onPost,
  onResolve,
  onClose,
  outsideScopeNote = null,
}: CommentsPanelProps): JSX.Element {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [posting, setPosting] = useState(false);

  async function handlePost(): Promise<void> {
    if (!text.trim()) return;
    setPosting(true);
    try {
      await onPost(text.trim());
      setText('');
    } finally {
      setPosting(false);
    }
  }

  return (
    <div
      data-testid="comments-panel"
      className="flex w-72 flex-col gap-3 rounded-lg border border-border bg-background p-4 shadow-elev-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{t('workspace.comments')}</span>
        <button
          type="button"
          aria-label={t('workspace.closeComments')}
          onClick={onClose}
          className="rounded-md p-1 text-muted hover:bg-surface hover:text-foreground"
        >
          <Icons.close size={ICON_SIZE.topbar} aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {outsideScopeNote ? (
          <div
            className="rounded border border-border bg-surface-strong p-2 text-xs text-muted"
            data-testid="comment-discipline-scope-note"
          >
            {outsideScopeNote}
          </div>
        ) : null}
        <textarea
          data-testid="comment-input"
          aria-label={t('workspace.addComment')}
          className="w-full rounded border border-border bg-surface p-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
          rows={3}
          placeholder={t('workspace.addComment')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void handlePost();
            }
          }}
        />
        <button
          type="button"
          data-testid="comment-post-btn"
          disabled={posting || !text.trim()}
          aria-busy={posting}
          onClick={() => void handlePost()}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {posting ? t('workspace.posting') : t('workspace.post')}
        </button>
      </div>
      <ul data-testid="comments-list" className="max-h-[40vh] space-y-2 overflow-auto">
        {comments.length === 0 ? (
          <li className="text-xs text-muted">{t('workspace.noComments')}</li>
        ) : (
          comments.map((c) => (
            <li
              key={c.id}
              className={['rounded border p-2', c.resolved ? 'opacity-60' : ''].join(' ').trim()}
            >
              <div className="text-xs font-semibold text-foreground">{c.userDisplay}</div>
              <div className="mt-0.5 text-xs text-muted">{c.body}</div>
              {c.createdAt ? (
                <div className="mt-0.5 text-[10px] text-muted">{c.createdAt}</div>
              ) : null}
              <button
                type="button"
                data-testid={c.resolved ? 'comment-reopen' : 'comment-resolve'}
                aria-label={c.resolved ? 'Reopen comment' : 'Resolve comment'}
                onClick={() => void onResolve(c.id, !c.resolved)}
                className="mt-1 text-[11px] text-accent hover:underline"
              >
                {c.resolved ? 'Reopen' : 'Resolve'}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
