import React from 'react';
import type { Comment } from '@bim-ai/core';

interface CommentPinProps {
  comment: Comment;
  x: number;
  y: number;
  onClick?: () => void;
}

export function CommentPin({ comment, x, y, onClick }: CommentPinProps) {
  const isResolved = comment.resolvedAt != null;
  const isOrphaned = comment.isOrphaned === true;
  const initials = comment.authorId.slice(0, 2).toUpperCase();

  return (
    <g
      transform={`translate(${x}, ${y})`}
      style={{ cursor: 'pointer', opacity: isResolved ? 0.3 : 1 }}
      onClick={onClick}
      aria-label={`Comment by ${comment.authorId}`}
    >
      <circle
        r={14}
        fill={isOrphaned ? 'var(--color-warning, #f59e0b)' : 'var(--color-accent)'}
        stroke="var(--color-surface)"
        strokeWidth={2}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="var(--color-accent-foreground)"
        fontSize={10}
        fontWeight={600}
      >
        {isOrphaned ? '?' : initials}
      </text>
    </g>
  );
}
