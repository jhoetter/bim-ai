import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { useMilestoneStore } from './milestoneStore';

type MilestoneDialogProps = {
  open: boolean;
  modelId: string;
  snapshotId: string;
  authorId?: string;
  onClose: () => void;
  onCreated?: (milestoneId: string) => void;
};

export function MilestoneDialog({
  open,
  modelId,
  snapshotId,
  authorId = 'local-dev',
  onClose,
  onCreated,
}: MilestoneDialogProps): ReactElement | null {
  const createMilestone = useMilestoneStore((s) => s.createMilestone);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setSubmitting(false);
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const handleSubmit = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const milestone = await createMilestone(
        modelId,
        trimmed,
        snapshotId,
        authorId,
        description.trim() || undefined,
      );
      onCreated?.(milestone.id);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [
    name,
    description,
    submitting,
    modelId,
    snapshotId,
    authorId,
    createMilestone,
    onCreated,
    onClose,
  ]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Save milestone"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 20,
          width: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--color-foreground)' }}
        >
          Save milestone
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="milestone-name"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontWeight: 500 }}
          >
            Name this milestone
          </label>
          <input
            id="milestone-name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Pre-client review v1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleSubmit();
            }}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-strong)',
              color: 'var(--color-foreground)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label
            htmlFor="milestone-description"
            style={{ fontSize: 'var(--text-xs)', color: 'var(--color-muted)', fontWeight: 500 }}
          >
            Description (optional)
          </label>
          <textarea
            id="milestone-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            style={{
              padding: '6px 10px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-strong)',
              color: 'var(--color-foreground)',
              fontSize: 'var(--text-sm)',
              outline: 'none',
              resize: 'vertical',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'transparent',
              color: 'var(--color-muted)',
              fontSize: 'var(--text-xs)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!name.trim() || submitting}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: 'var(--color-accent-soft)',
              color: 'var(--color-foreground)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              cursor: !name.trim() || submitting ? 'default' : 'pointer',
              opacity: !name.trim() || submitting ? 0.5 : 1,
            }}
          >
            {submitting ? 'Saving…' : 'Save milestone'}
          </button>
        </div>
      </div>
    </div>
  );
}
