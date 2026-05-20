import React, { type JSX, useEffect } from 'react';
import { useMilestoneStore } from '../collab/milestoneStore';

interface ProjectVersionHistoryPanelProps {
  modelId: string;
  onClose: () => void;
  onRestore?: (milestoneId: string) => void;
}

export function ProjectVersionHistoryPanel({
  modelId,
  onClose,
  onRestore,
}: ProjectVersionHistoryPanelProps): JSX.Element {
  const { milestones, loading, fetchMilestones, deleteMilestone } = useMilestoneStore();

  useEffect(() => {
    void fetchMilestones(modelId);
  }, [modelId, fetchMilestones]);

  return (
    <div
      data-testid="version-history-panel"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440,
        maxHeight: 520,
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10000,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Version History</span>
        <button
          data-testid="version-history-close"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: 'inherit',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loading && (
          <p style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>Loading…</p>
        )}
        {!loading && milestones.length === 0 && (
          <p style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
            No saved versions yet. Use &ldquo;Save Milestone&rdquo; to create one.
          </p>
        )}
        {milestones.map((m) => (
          <div
            key={m.id}
            data-testid={`version-history-row-${m.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
              <div style={{ fontSize: 10, color: 'var(--color-muted-foreground)', marginTop: 2 }}>
                {new Date(m.createdAt).toLocaleString()}
              </div>
            </div>
            <button
              data-testid={`version-history-restore-${m.id}`}
              onClick={() => onRestore?.(m.id)}
              style={{ fontSize: 10, padding: '2px 8px', cursor: 'pointer', borderRadius: 3 }}
            >
              Restore
            </button>
            <button
              data-testid={`version-history-delete-${m.id}`}
              onClick={() => void deleteMilestone(modelId, m.id)}
              style={{
                fontSize: 10,
                padding: '2px 6px',
                cursor: 'pointer',
                borderRadius: 3,
                opacity: 0.6,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
