import React, { useCallback, useEffect, useState } from 'react';

import type { Role, RoleAssignment } from '@bim-ai/core';

type Tab = 'members' | 'invite' | 'public-link';

interface Props {
  modelId: string;
  open: boolean;
  onClose: () => void;
}

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
  'public-link-viewer': 'Public viewer',
};

export function ShareModal({ modelId, open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('members');
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('viewer');
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [publicExpiry, setPublicExpiry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await fetch(`/api/models/${modelId}/roles`);
      if (!res.ok) return;
      const data = await res.json();
      setAssignments(data.roles ?? []);
    } catch {
      // silently ignore network failure during fetch
    }
  }, [modelId]);

  useEffect(() => {
    if (open) {
      fetchAssignments();
      setError(null);
    }
  }, [open, fetchAssignments]);

  const handleRevokeRole = useCallback(
    async (assignmentId: string) => {
      await fetch(`/api/models/${modelId}/roles/${assignmentId}`, { method: 'DELETE' });
      await fetchAssignments();
    },
    [modelId, fetchAssignments],
  );

  const handleInvite = useCallback(async () => {
    if (!inviteEmail.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/models/${modelId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectKind: 'user',
          subjectId: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { detail?: string }).detail ?? 'Failed to invite');
      } else {
        setInviteEmail('');
        await fetchAssignments();
        setTab('members');
      }
    } finally {
      setLoading(false);
    }
  }, [modelId, inviteEmail, inviteRole, fetchAssignments]);

  const handleCreatePublicLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bodyPayload: { expiresAt?: number } = {};
      if (publicExpiry) {
        bodyPayload.expiresAt = new Date(publicExpiry).getTime();
      }
      const res = await fetch(`/api/models/${modelId}/public-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? 'Failed to create link');
      } else {
        const data = await res.json();
        setPublicToken((data as { token: string }).token);
      }
    } finally {
      setLoading(false);
    }
  }, [modelId, publicExpiry]);

  if (!open) return null;

  const publicLinkUrl = publicToken
    ? `${window.location.origin}/api/models/${modelId}/snapshot?token=${publicToken}`
    : null;

  const members = assignments.filter((a) => a.subjectKind === 'user');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share model"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.4)',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--surface-default, #fff)',
          borderRadius: 8,
          width: 480,
          maxWidth: '90vw',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <strong style={{ fontSize: 16 }}>Share model</strong>
          <button
            onClick={onClose}
            aria-label="Close share modal"
            style={{ border: 'none', background: 'none', cursor: 'pointer' }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['members', 'invite', 'public-link'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid var(--border-default, #ccc)',
                background: tab === t ? 'var(--accent, #2563eb)' : 'transparent',
                color: tab === t ? '#fff' : 'inherit',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {t === 'members'
                ? 'Workspace members'
                : t === 'invite'
                  ? 'Invite by email'
                  : 'Public link'}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ color: 'var(--error, #dc2626)', marginBottom: 12, fontSize: 13 }}>
            {error}
          </div>
        )}

        {tab === 'members' && (
          <div>
            {members.length === 0 && (
              <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: 13 }}>
                No workspace members yet. Use &ldquo;Invite by email&rdquo; to add collaborators.
              </p>
            )}
            {members.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border-subtle, #f0f0f0)',
                }}
              >
                <span style={{ fontSize: 13 }}>{a.subjectId}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted, #6b7280)' }}>
                    {ROLE_LABELS[a.role as Role] ?? a.role}
                  </span>
                  <button
                    onClick={() => handleRevokeRole(a.id)}
                    style={{
                      fontSize: 11,
                      color: 'var(--error, #dc2626)',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'invite' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="email"
              placeholder="name@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid var(--border-default, #ccc)',
                fontSize: 13,
              }}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              style={{
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid var(--border-default, #ccc)',
                fontSize: 13,
              }}
            >
              {(['editor', 'viewer'] as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <button
              onClick={handleInvite}
              disabled={loading || !inviteEmail.trim()}
              style={{
                padding: '8px 16px',
                borderRadius: 4,
                background: 'var(--accent, #2563eb)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {loading ? 'Sending…' : 'Send invite'}
            </button>
          </div>
        )}

        {tab === 'public-link' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {publicLinkUrl ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-muted, #6b7280)' }}>
                  Anyone with this link can comment on the model (read-only).
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    readOnly
                    value={publicLinkUrl}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--border-default, #ccc)',
                      fontSize: 12,
                    }}
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(publicLinkUrl)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 4,
                      border: '1px solid var(--border-default, #ccc)',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                  >
                    Copy
                  </button>
                </div>
              </>
            ) : (
              <>
                <label style={{ fontSize: 13 }}>
                  Expiry (optional)
                  <input
                    type="datetime-local"
                    value={publicExpiry}
                    onChange={(e) => setPublicExpiry(e.target.value)}
                    style={{
                      display: 'block',
                      marginTop: 4,
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--border-default, #ccc)',
                      fontSize: 13,
                      width: '100%',
                    }}
                  />
                </label>
                <button
                  onClick={handleCreatePublicLink}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 4,
                    background: 'var(--accent, #2563eb)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {loading ? 'Creating…' : 'Create public link'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
