/**
 * COL-V3-04 — ParticipantStrip tests.
 *
 * Covers: avatar count, overflow, local-user ring, offline opacity,
 * online dot, hex-literal absence, initials derivation, empty state,
 * CSS var usage, and tooltip display-name.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import type { Participant } from '@bim-ai/core';
import { ParticipantStrip, deriveInitials } from './ParticipantStrip';

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeParticipant(overrides: Partial<Participant> & { userId: string }): Participant {
  return {
    userId: overrides.userId,
    displayName: overrides.displayName ?? `User ${overrides.userId}`,
    initials: overrides.initials ?? overrides.userId.slice(0, 2).toUpperCase(),
    color: overrides.color ?? 'var(--collab-color-1)',
    isOnline: overrides.isOnline ?? true,
    lastSeenAt: overrides.lastSeenAt ?? new Date().toISOString(),
    role: overrides.role ?? 'editor',
    sessionStartedAt: overrides.sessionStartedAt ?? Date.now(),
  };
}

const LOCAL_USER_ID = 'user-local';

const THREE_PARTICIPANTS: Participant[] = [
  makeParticipant({ userId: LOCAL_USER_ID, displayName: 'Alice Brown', isOnline: true }),
  makeParticipant({ userId: 'user-2', displayName: 'Bob Chen', isOnline: true }),
  makeParticipant({ userId: 'user-3', displayName: 'Carol Davis', isOnline: false }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ParticipantStrip — COL-V3-04', () => {
  it('renders correct avatar count up to maxVisible', () => {
    const { getAllByTestId } = render(
      <ParticipantStrip
        participants={THREE_PARTICIPANTS}
        localUserId={LOCAL_USER_ID}
        maxVisible={5}
      />,
    );
    expect(getAllByTestId('participant-avatar')).toHaveLength(3);
  });

  it('caps visible avatars at maxVisible', () => {
    const participants = Array.from({ length: 8 }, (_, i) =>
      makeParticipant({ userId: `user-${i}`, displayName: `Person ${i}` }),
    );
    const { getAllByTestId } = render(
      <ParticipantStrip participants={participants} localUserId="user-0" maxVisible={5} />,
    );
    expect(getAllByTestId('participant-avatar')).toHaveLength(5);
  });

  it('supports compact avatar sizing for dense header buttons', () => {
    const { getAllByTestId } = render(
      <ParticipantStrip
        participants={THREE_PARTICIPANTS}
        localUserId={LOCAL_USER_ID}
        maxVisible={2}
        avatarSize={20}
      />,
    );
    const avatars = getAllByTestId('participant-avatar');
    expect((avatars[0] as HTMLElement).style.width).toBe('20px');
    expect((avatars[0] as HTMLElement).style.height).toBe('20px');
  });

  it('can render the participant strip as the clickable header control', () => {
    const onClick = vi.fn();
    const { getByTestId } = render(
      <ParticipantStrip
        participants={THREE_PARTICIPANTS}
        localUserId={LOCAL_USER_ID}
        maxVisible={3}
        avatarSize={20}
        onClick={onClick}
        buttonLabel="Open collaboration comments"
        title="Open collaboration comments"
        testId="workspace-header-participants"
      />,
    );

    const control = getByTestId('workspace-header-participants') as HTMLButtonElement;
    expect(control.tagName).toBe('BUTTON');
    expect(control.getAttribute('aria-label')).toBe('Open collaboration comments');
    expect(control.style.background).toBe('transparent');
    expect(control.style.border).toBe('0px');
    expect(control.style.padding).toBe('0px');

    fireEvent.click(control);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows "+N" overflow chip when participants > maxVisible', () => {
    const participants = Array.from({ length: 8 }, (_, i) =>
      makeParticipant({ userId: `user-${i}` }),
    );
    const { getByTestId } = render(
      <ParticipantStrip participants={participants} localUserId="user-0" maxVisible={5} />,
    );
    const chip = getByTestId('overflow-chip');
    expect(chip.textContent).toBe('+3');
  });

  it('does NOT show overflow chip when participants <= maxVisible', () => {
    const { queryByTestId } = render(
      <ParticipantStrip
        participants={THREE_PARTICIPANTS}
        localUserId={LOCAL_USER_ID}
        maxVisible={5}
      />,
    );
    expect(queryByTestId('overflow-chip')).toBeNull();
  });

  it('local user avatar has an inset ring that stays inside the topbar control', () => {
    const { getAllByTestId } = render(
      <ParticipantStrip
        participants={THREE_PARTICIPANTS}
        localUserId={LOCAL_USER_ID}
        maxVisible={5}
      />,
    );
    const avatars = getAllByTestId('participant-avatar');
    const localAvatar = avatars.find((el) => el.dataset.userId === LOCAL_USER_ID);
    expect(localAvatar).toBeDefined();
    expect(localAvatar?.dataset.isLocal).toBe('true');
    // Verify the ring uses an inset shadow so it does not paint outside the avatar box.
    const ringStyle = (localAvatar as HTMLElement).style.boxShadow;
    expect(ringStyle).toContain('inset');
    expect(ringStyle).toContain('var(--color-accent)');
    expect((localAvatar as HTMLElement).style.outline).toBe('');
  });

  it('offline participant has opacity 0.5', () => {
    const { getAllByTestId } = render(
      <ParticipantStrip
        participants={THREE_PARTICIPANTS}
        localUserId={LOCAL_USER_ID}
        maxVisible={5}
      />,
    );
    const avatars = getAllByTestId('participant-avatar');
    const offlineAvatar = avatars.find((el) => el.dataset.isOnline === 'false');
    expect(offlineAvatar).toBeDefined();
    expect((offlineAvatar as HTMLElement).style.opacity).toBe('0.5');
  });

  it('online participant has opacity 1', () => {
    const { getAllByTestId } = render(
      <ParticipantStrip
        participants={THREE_PARTICIPANTS}
        localUserId={LOCAL_USER_ID}
        maxVisible={5}
      />,
    );
    const avatars = getAllByTestId('participant-avatar');
    const onlineAvatar = avatars.find((el) => el.dataset.isOnline === 'true');
    expect(onlineAvatar).toBeDefined();
    expect((onlineAvatar as HTMLElement).style.opacity).toBe('1');
  });

  it('online indicator dot is rendered for online participants', () => {
    const { getAllByTestId } = render(
      <ParticipantStrip
        participants={THREE_PARTICIPANTS}
        localUserId={LOCAL_USER_ID}
        maxVisible={5}
      />,
    );
    // 2 online out of 3 → 2 dots
    const dots = getAllByTestId('online-dot');
    expect(dots).toHaveLength(2);
  });

  it('keeps the online indicator inside the avatar paint box', () => {
    const { getAllByTestId } = render(
      <ParticipantStrip
        participants={THREE_PARTICIPANTS}
        localUserId={LOCAL_USER_ID}
        maxVisible={5}
        avatarSize={24}
      />,
    );
    const dot = getAllByTestId('online-dot')[0] as HTMLElement;
    expect(dot.style.boxSizing).toBe('border-box');
    expect(dot.style.bottom).toBe('2px');
    expect(dot.style.right).toBe('2px');
    expect(dot.style.border).toContain('1px');
  });

  it('zero hex literals in rendered DOM inline styles', () => {
    const { getByTestId } = render(
      <ParticipantStrip
        participants={THREE_PARTICIPANTS}
        localUserId={LOCAL_USER_ID}
        maxVisible={5}
      />,
    );
    const strip = getByTestId('participant-strip');
    // Walk all inline style attributes in the subtree.
    const allElements = Array.from(strip.querySelectorAll<HTMLElement>('*'));
    allElements.push(strip);
    for (const el of allElements) {
      const styleText = el.getAttribute('style') ?? '';
      expect(styleText, `Hex literal found in style of ${el.tagName}: "${styleText}"`).not.toMatch(
        /#[0-9a-fA-F]{3,8}\b/,
      );
    }
  });

  it('derives initials from first+last name', () => {
    expect(deriveInitials('Alice Brown', 'fallback')).toBe('AB');
    expect(deriveInitials('Bob Chen', 'fallback')).toBe('BC');
    expect(deriveInitials('Carol Ann Davis', 'fallback')).toBe('CD');
  });

  it('falls back to first 2 chars of userId when displayName is undefined', () => {
    expect(deriveInitials(undefined, 'xyz-user')).toBe('XY');
  });

  it('renders empty state (null) when 0 participants', () => {
    const { queryByTestId } = render(
      <ParticipantStrip participants={[]} localUserId={LOCAL_USER_ID} />,
    );
    expect(queryByTestId('participant-strip')).toBeNull();
  });

  it('color token CSS vars used in avatar backgrounds, not hex literals', () => {
    const participants = [
      makeParticipant({ userId: 'u1', color: 'var(--collab-color-1)' }),
      makeParticipant({ userId: 'u2', color: 'var(--collab-color-2)' }),
    ];
    const { getAllByTestId } = render(
      <ParticipantStrip participants={participants} localUserId="u1" />,
    );
    const avatars = getAllByTestId('participant-avatar');
    avatars.forEach((avatar) => {
      const bg = (avatar as HTMLElement).style.background;
      expect(bg).toMatch(/var\(--collab-color-\d\)/);
      expect(bg).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    });
  });

  it('tooltip shows displayName for each avatar', () => {
    const { getAllByTestId } = render(
      <ParticipantStrip
        participants={THREE_PARTICIPANTS}
        localUserId={LOCAL_USER_ID}
        maxVisible={5}
      />,
    );
    const avatars = getAllByTestId('participant-avatar');
    const titles = avatars.map((el) => el.getAttribute('title') ?? '');
    expect(titles.some((t) => t.includes('Alice Brown'))).toBe(true);
    expect(titles.some((t) => t.includes('Bob Chen'))).toBe(true);
    expect(titles.some((t) => t.includes('Carol Davis'))).toBe(true);
  });
});
