import type { Participant } from '@bim-ai/core';

interface Props {
  participants: Participant[];
  currentUserId: string;
}

const MAX_VISIBLE = 5;

export function ParticipantStrip({ participants, currentUserId }: Props) {
  const others = participants.filter((p) => p.userId !== currentUserId);
  const visible = others.slice(0, MAX_VISIBLE);
  const overflow = others.length - visible.length;

  if (others.length === 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 'var(--space-4)',
        right: 'var(--space-4)',
        zIndex: 'var(--z-collab-strip, 40)' as unknown as number,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-2)',
      }}
    >
      {visible.map((p) => (
        <ParticipantAvatar key={p.userId} participant={p} />
      ))}
      {overflow > 0 && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-surface-strong)',
            border: '1.5px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-muted-foreground)',
            fontWeight: 600,
          }}
          title={`${overflow} more participant${overflow === 1 ? '' : 's'}`}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}

function ParticipantAvatar({ participant }: { participant: Participant }) {
  const initials = participant.userId.slice(0, 2).toUpperCase();
  const label = `${participant.userId} (${participant.role})`;
  return (
    <div
      title={label}
      aria-label={label}
      style={{
        width: 28,
        height: 28,
        borderRadius: 'var(--radius-pill)',
        background: 'var(--color-surface)',
        border: `2px solid ${participant.color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--text-xs)',
        fontWeight: 700,
        color: 'var(--color-foreground)',
        cursor: 'default',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
