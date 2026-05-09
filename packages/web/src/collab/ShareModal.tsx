import React, { useCallback, useEffect, useState } from 'react';

import type { PublicLink, Role, RoleAssignment } from '@bim-ai/core';

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
  const [publicLinks, setPublicLinks] = useState<PublicLink[]>([]);
  const [publicExpiry, setPublicExpiry] = useState('');
  const [publicPassword, setPublicPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);

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

  const fetchPublicLinks = useCallback(async () => {
    try {
      const res = await fetch(`/api/models/${modelId}/public-links`);
      if (!res.ok) return;
      const data = await res.json();
      setPublicLinks(data.links ?? []);
    } catch {
      // silently ignore network failure during fetch
    }
  }, [modelId]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      fetchAssignments();
      setError(null);
    }
  }, [open, fetchAssignments]);

  useEffect(() => {
    if (open && tab === 'public-link') {
      fetchPublicLinks();
    }
  }, [open, tab, fetchPublicLinks]);

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
      const bodyPayload: { expiresAt?: number; password?: string } = {};
      if (publicExpiry) bodyPayload.expiresAt = new Date(publicExpiry).getTime();
      if (publicPassword) bodyPayload.password = publicPassword;
      const res = await fetch(`/api/models/${modelId}/public-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? 'Failed to create link');
      } else {
        setPublicPassword('');
        await fetchPublicLinks();
      }
    } finally {
      setLoading(false);
    }
  }, [modelId, publicExpiry, publicPassword, fetchPublicLinks]);

  const handleRevokePublicLink = useCallback(
    async (linkId: string) => {
      setLoading(true);
      setError(null);
      try {
        await fetch(`/api/models/${modelId}/public-links/${linkId}/revoke`, { method: 'POST' });
        await fetchPublicLinks();
      } finally {
        setLoading(false);
      }
    },
    [modelId, fetchPublicLinks],
  );

  if (!open) return null;

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
          background: 'var(--color-surface)',
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
            type="button"
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
              type="button"
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '6px 12px',
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                background: tab === t ? 'var(--color-accent)' : 'transparent',
                color: tab === t ? 'var(--color-accent-foreground)' : 'inherit',
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
          <div style={{ color: 'var(--color-danger)', marginBottom: 12, fontSize: 13 }}>
            {error}
          </div>
        )}

        {tab === 'members' && (
          <div>
            {members.length === 0 && (
              <p style={{ color: 'var(--color-muted-foreground)', fontSize: 13 }}>
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
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <span style={{ fontSize: 13 }}>{a.subjectId}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
                    {ROLE_LABELS[a.role as Role] ?? a.role}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRevokeRole(a.id)}
                    style={{
                      fontSize: 11,
                      color: 'var(--color-danger)',
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
              aria-label="Email address to invite"
              placeholder="name@example.com"
              autoFocus
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              style={{
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                fontSize: 13,
              }}
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              style={{
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-border)',
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
              type="button"
              onClick={handleInvite}
              disabled={loading || !inviteEmail.trim()}
              style={{
                padding: '8px 16px',
                borderRadius: 4,
                background: 'var(--color-accent)',
                color: 'var(--color-accent-foreground)',
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
            {publicLinks.length > 0 ? (
              publicLinks.map((link) => {
                const url = `${window.location.origin}/shared/${link.token}`;
                return (
                  <div key={link.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ fontSize: 13, color: 'var(--color-muted-foreground)', margin: 0 }}>
                      Public link is active. Anyone with the link can view this model (read-only).
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        readOnly
                        value={url}
                        aria-label="Public link URL"
                        style={{
                          flex: 1,
                          padding: '8px 10px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border)',
                          fontSize: 12,
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Copy public link to clipboard"
                        onClick={() => {
                          void navigator.clipboard.writeText(url).then(() => {
                            setCopiedLinkId(link.id);
                            setTimeout(() => setCopiedLinkId(null), 2000);
                          });
                        }}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 4,
                          border: '1px solid var(--color-border)',
                          cursor: 'pointer',
                          fontSize: 12,
                          color: copiedLinkId === link.id ? 'var(--color-accent)' : 'inherit',
                          fontWeight: copiedLinkId === link.id ? 600 : 400,
                        }}
                      >
                        {copiedLinkId === link.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>
                        {link.displayName ? `Shared by ${link.displayName} · ` : ''}
                        Opened {link.openCount} time{link.openCount !== 1 ? 's' : ''}
                      </span>
                      <button
                        type="button"
                        aria-label="Revoke public link"
                        onClick={() => handleRevokePublicLink(link.id)}
                        disabled={loading}
                        style={{
                          fontSize: 12,
                          color: 'var(--color-danger)',
                          border: 'none',
                          background: 'none',
                          cursor: 'pointer',
                          padding: '4px 8px',
                        }}
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--color-muted-foreground)', margin: 0 }}>
                  Create a public link to share this model as read-only.
                </p>
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
                      border: '1px solid var(--color-border)',
                      fontSize: 13,
                      width: '100%',
                    }}
                  />
                </label>
                <label style={{ fontSize: 13 }}>
                  Password (optional)
                  <input
                    type="password"
                    value={publicPassword}
                    onChange={(e) => setPublicPassword(e.target.value)}
                    placeholder="Leave blank for no password"
                    style={{
                      display: 'block',
                      marginTop: 4,
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border)',
                      fontSize: 13,
                      width: '100%',
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleCreatePublicLink}
                  disabled={loading}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 4,
                    background: 'var(--color-accent)',
                    color: 'var(--color-accent-foreground)',
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
