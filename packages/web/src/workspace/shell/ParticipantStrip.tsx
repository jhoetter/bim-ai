/**
 * COL-V3-04 — ParticipantStrip.
 *
 * Shows up to `maxVisible` (default 5) participant avatars as 28 px circles.
 * When the participant count exceeds maxVisible an overflow "+N" chip is shown.
 *
 * Design rules:
 *   - Avatar bg: participant.color (CSS var assigned by presence layer)
 *   - Initials:  max 2 chars, white, var(--text-xs)
 *   - Online:    2 px green dot at bottom-right using var(--color-success)
 *   - Offline:   opacity 0.5
 *   - Local user: inset 2 px ring in var(--color-accent)
 *   - Overflow chip: "+N" with var(--color-surface-2, var(--color-surface-strong)) bg
 *   - Tooltip: displayName + online / offline indicator
 *
 * Zero hex literals in this file. All colour references use CSS vars.
 *
 * v3 scope: participant strip only. Live cursors / selection halos deferred to v3.1.
 */
import type { CSSProperties, JSX } from 'react';
import type { Participant } from '@bim-ai/core';

export type ParticipantStripProps = {
  participants: Participant[];
  localUserId: string;
  maxVisible?: number;
  avatarSize?: number;
};

const AVATAR_SIZE = 28;

/** Derive up-to-2-char initials from a displayName (or userId fallback). */
export function deriveInitials(displayName: string | undefined, userId: string): string {
  const name = displayName ?? userId;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase().slice(0, 2);
  }
  return name.slice(0, 2).toUpperCase();
}

export function ParticipantStrip({
  participants,
  localUserId,
  maxVisible = 5,
  avatarSize = AVATAR_SIZE,
}: ParticipantStripProps): JSX.Element | null {
  if (participants.length === 0) return null;

  const visible = participants.slice(0, maxVisible);
  const overflow = participants.length - visible.length;

  return (
    <div data-testid="participant-strip" style={stripStyle} aria-label="Participants" role="group">
      {visible.map((p) => (
        <ParticipantAvatar
          key={p.userId}
          participant={p}
          isLocal={p.userId === localUserId}
          avatarSize={avatarSize}
        />
      ))}
      {overflow > 0 && <OverflowChip count={overflow} avatarSize={avatarSize} />}
    </div>
  );
}

const stripStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-1)',
};

function ParticipantAvatar({
  participant,
  isLocal,
  avatarSize,
}: {
  participant: Participant;
  isLocal: boolean;
  avatarSize: number;
}): JSX.Element {
  const initials = deriveInitials(participant.displayName, participant.userId);
  const isOnline = participant.isOnline ?? false;
  const tooltipLabel = `${participant.displayName ?? participant.userId} — ${isOnline ? 'online' : 'offline'}`;

  const avatarStyle: CSSProperties = {
    position: 'relative',
    width: avatarSize,
    height: avatarSize,
    borderRadius: 'var(--radius-pill)',
    background: participant.color,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--text-xs)',
    fontWeight: 700,
    color: 'var(--color-accent-foreground)',
    cursor: 'default',
    flexShrink: 0,
    opacity: isOnline ? 1 : 0.5,
    boxSizing: 'border-box',
    boxShadow: isLocal ? 'inset 0 0 0 2px var(--color-accent)' : 'none',
  };

  return (
    <div
      data-testid="participant-avatar"
      data-user-id={participant.userId}
      data-is-local={isLocal ? 'true' : 'false'}
      data-is-online={isOnline ? 'true' : 'false'}
      title={tooltipLabel}
      aria-label={tooltipLabel}
      style={avatarStyle}
    >
      <span aria-hidden="true">{initials}</span>
      {isOnline && <span data-testid="online-dot" aria-hidden="true" style={onlineDotStyle} />}
    </div>
  );
}

const onlineDotStyle: CSSProperties = {
  position: 'absolute',
  bottom: 1,
  right: 1,
  width: 7,
  height: 7,
  borderRadius: 'var(--radius-pill)',
  background: 'var(--color-success)',
  border: '2px solid var(--color-background)',
};

function OverflowChip({ count, avatarSize }: { count: number; avatarSize: number }): JSX.Element {
  const overflowChipStyle: CSSProperties = {
    ...baseOverflowChipStyle,
    width: avatarSize,
    height: avatarSize,
  };

  return (
    <div
      data-testid="overflow-chip"
      title={`${count} more participant${count === 1 ? '' : 's'}`}
      style={overflowChipStyle}
    >
      +{count}
    </div>
  );
}

const baseOverflowChipStyle: CSSProperties = {
  borderRadius: 'var(--radius-pill)',
  background: 'var(--color-surface-2, var(--color-surface-strong))',
  border: '1px solid var(--color-border)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 'var(--text-xs)',
  color: 'var(--color-muted-foreground)',
  fontWeight: 600,
  cursor: 'default',
  flexShrink: 0,
};
