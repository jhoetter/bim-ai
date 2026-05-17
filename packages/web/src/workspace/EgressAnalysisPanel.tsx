import React, { useState } from 'react';
import type { RoomNode, EgressPath } from '../plan/roomGraph';

interface Props {
  rooms: RoomNode[];
  onRun: (startRoomId: string, exitRoomIds: string[]) => EgressPath | null;
  onClose: () => void;
}

export function EgressAnalysisPanel({ rooms, onRun, onClose }: Props) {
  const [startId, setStartId] = useState(rooms[0]?.roomId ?? '');
  const [result, setResult] = useState<EgressPath | null | 'none'>(null);

  const exitRooms = rooms.filter((r) => /exit|exterior|ausgang/i.test(r.name));

  const run = () => {
    const path = onRun(
      startId,
      exitRooms.map((r) => r.roomId),
    );
    setResult(path ?? 'none');
  };

  return (
    <div
      data-testid="egress-analysis-panel"
      style={{
        padding: 16,
        background: 'var(--color-surface)',
        border: '1px solid #ccc',
        borderRadius: 6,
      }}
    >
      <h4>Egress Analysis</h4>
      <label>
        Start room:
        <select
          data-testid="egress-start-room"
          value={startId}
          onChange={(e) => setStartId(e.target.value)}
        >
          {rooms.map((r) => (
            <option key={r.roomId} value={r.roomId}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}>
        Exit rooms:{' '}
        {exitRooms.map((r) => r.name).join(', ') || '(none — label rooms "Exit" or "Ausgang")'}
      </div>
      <button data-testid="egress-run-btn" onClick={run}>
        Run Analysis
      </button>
      <button data-testid="egress-close-btn" onClick={onClose}>
        Close
      </button>
      {result === 'none' && (
        <p data-testid="egress-no-path" style={{ color: 'var(--color-danger)' }}>
          No egress path found.
        </p>
      )}
      {result && result !== 'none' && (
        <p data-testid="egress-path-result" style={{ color: 'var(--color-success)' }}>
          Path: {result.roomIds.length} rooms, {(result.totalDistanceMm / 1000).toFixed(1)}m
        </p>
      )}
    </div>
  );
}
