/**
 * COL-V3-01 — collab session types.
 *
 * These are wire-format types for the yjs Y-WebSocket collab layer.
 * ydoc and awareness are runtime objects and are not serialised here.
 */

export type ParticipantRole = 'admin' | 'editor' | 'viewer' | 'public-link-viewer';

export type Participant = {
  userId: string;
  role: ParticipantRole;
  color: string;
  sessionStartedAt: number;
};

export type CollabSession = {
  modelId: string;
  participants: Participant[];
};

export type InFlightCommand = {
  commandId: string;
  authorId: string;
  kind: string;
  proposedAt: number;
};

export type CollabAwarenessState = {
  userId: string;
  color: string;
  role: ParticipantRole;
  selectedElementIds: string[];
  cursorMm?: { xMm: number; yMm: number; zMm: number };
};

/** Ordered list of CSS token names from the --cat-* palette used for participant colors. */
export const PARTICIPANT_COLOR_TOKENS: readonly string[] = [
  '--cat-wall',
  '--cat-roof',
  '--cat-door',
  '--cat-window',
  '--cat-stair',
] as const;

/** Assign a CSS token variable from the --cat-* palette to a participant index. */
export function participantColorToken(index: number): string {
  return PARTICIPANT_COLOR_TOKENS[index % PARTICIPANT_COLOR_TOKENS.length]!;
}
