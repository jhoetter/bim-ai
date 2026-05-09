import React, { useCallback, useRef, useState } from 'react';
import type { Comment } from '@bim-ai/core';

interface CommentThreadProps {
  comments: Comment[];
  onReply: (body: string) => void;
  onResolve: () => void;
  onClose: () => void;
}

export function CommentThread({ comments, onReply, onResolve, onClose }: CommentThreadProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onResolve();
        onClose();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (draft.trim()) {
          onReply(draft.trim());
          setDraft('');
        }
        return;
      }
    },
    [draft, onReply, onResolve, onClose],
  );

  return (
    <div
      role="dialog"
      aria-label="Comment thread"
      style={{
        background: 'var(--surface-overlay)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 12,
        minWidth: 280,
        maxWidth: 360,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {comments.map((c) => (
        <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{c.authorId}</span>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>{c.body}</span>
        </div>
      ))}
      <textarea
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Reply… (Enter to send, Cmd+Enter to resolve, Esc to close)"
        rows={2}
        style={{
          resize: 'none',
          border: '1px solid var(--color-border)',
          borderRadius: 4,
          padding: '6px 8px',
          fontSize: 13,
          background: 'var(--surface-input)',
          color: 'var(--text-primary)',
          outline: 'none',
        }}
      />
    </div>
  );
}
