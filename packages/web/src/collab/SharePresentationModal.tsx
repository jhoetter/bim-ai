import React, { useCallback, useEffect, useState } from 'react';

interface PresentationRecord {
  id: string;
  modelId: string;
  token: string;
  createdBy: string;
  createdAt: number;
  expiresAt?: number;
  isRevoked: boolean;
  openCount: number;
}

interface PageOption {
  id: string;
  name: string;
}

interface Props {
  modelId: string;
  open: boolean;
  onClose: () => void;
  pages?: PageOption[];
}

const NEW_LINK_COPIED_ID = '__new_presentation_link__';

export function SharePresentationModal({ modelId, open, onClose, pages = [] }: Props) {
  const [presentations, setPresentations] = useState<PresentationRecord[]>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [allPages, setAllPages] = useState(true);
  const [allowMeasurement, setAllowMeasurement] = useState(false);
  const [allowComment, setAllowComment] = useState(false);
  const [expiry, setExpiry] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const fetchPresentations = useCallback(async () => {
    try {
      const res = await fetch(`/api/models/${modelId}/presentations`);
      if (!res.ok) return;
      const data = await res.json();
      setPresentations(data.presentations ?? []);
    } catch {
      // silently ignore
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
      fetchPresentations();
      setError(null);
    }
  }, [open, fetchPresentations]);

  const handlePageToggle = useCallback((pageId: string) => {
    setSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((id) => id !== pageId) : [...prev, pageId],
    );
  }, []);

  const handleAllPagesToggle = useCallback(() => {
    setAllPages((prev) => !prev);
    setSelectedPageIds([]);
  }, []);

  const handleCopyLink = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pageScopeIds = allPages ? [] : selectedPageIds;
      const body: Record<string, unknown> = {
        pageScopeIds,
        allowMeasurement,
        allowComment,
      };
      if (expiry) body.expiresAt = new Date(expiry).getTime();

      const res = await fetch(`/api/models/${modelId}/presentations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { detail?: string }).detail ?? 'Failed to create presentation');
        return;
      }
      const data = await res.json();
      const url = `${window.location.origin}/p/${data.token}`;
      await navigator.clipboard.writeText(url);
      setCopiedToken(NEW_LINK_COPIED_ID);
      setTimeout(() => setCopiedToken(null), 2000);
      await fetchPresentations();
    } finally {
      setLoading(false);
    }
  }, [
    modelId,
    allPages,
    selectedPageIds,
    allowMeasurement,
    allowComment,
    expiry,
    fetchPresentations,
  ]);

  const handleCopyExistingLink = useCallback(async (token: string) => {
    setError(null);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${token}`);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      setError('Failed to copy presentation link');
    }
  }, []);

  const handleSetActive = useCallback(
    async (linkId: string, active: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const action = active ? 'activate' : 'revoke';
        const res = await fetch(`/api/models/${modelId}/presentations/${linkId}/${action}`, {
          method: 'POST',
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(
            (data as { detail?: string }).detail ??
              `Failed to ${active ? 'activate' : 'deactivate'} presentation`,
          );
          return;
        }
        await fetchPresentations();
      } finally {
        setLoading(false);
      }
    },
    [modelId, fetchPresentations],
  );

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share live presentation"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-overlay)',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--color-surface-2)',
          borderRadius: 8,
          width: 520,
          maxWidth: '90vw',
          maxHeight: '85vh',
          overflowY: 'auto',
          padding: '24px',
          boxShadow: '0 8px 32px var(--shadow-modal)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <strong style={{ fontSize: 16, color: 'var(--color-foreground)' }}>
            Share live presentation
          </strong>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close share presentation modal"
            style={{
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--color-muted-foreground)',
            }}
          >
            ✕
          </button>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              color: 'var(--color-danger)',
              marginBottom: 12,
              fontSize: 'var(--text-sm)',
            }}
          >
            {error}
          </div>
        )}

        {pages.length > 0 && (
          <section style={{ marginBottom: 20 }}>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--color-foreground)',
                marginBottom: 8,
              }}
            >
              Scope
            </p>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 'var(--text-sm)',
                color: 'var(--color-foreground)',
                marginBottom: 6,
              }}
            >
              <input type="checkbox" checked={allPages} onChange={handleAllPagesToggle} />
              All pages
            </label>
            {!allPages &&
              pages.map((page) => (
                <label
                  key={page.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-muted-foreground)',
                    marginBottom: 4,
                    paddingLeft: 20,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPageIds.includes(page.id)}
                    onChange={() => handlePageToggle(page.id)}
                  />
                  {page.name}
                </label>
              ))}
          </section>
        )}

        <section style={{ marginBottom: 20 }}>
          <p
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 600,
              color: 'var(--color-foreground)',
              marginBottom: 8,
            }}
          >
            Viewer permissions
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-foreground)',
              marginBottom: 6,
            }}
          >
            <input
              type="checkbox"
              checked={allowMeasurement}
              onChange={(e) => setAllowMeasurement(e.target.checked)}
            />
            Allow measurement
          </label>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 'var(--text-sm)',
              color: 'var(--color-foreground)',
            }}
          >
            <input
              type="checkbox"
              checked={allowComment}
              onChange={(e) => setAllowComment(e.target.checked)}
            />
            Allow comment
          </label>
        </section>

        <section style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 'var(--text-sm)', color: 'var(--color-foreground)' }}>
            Expiry (optional)
            <input
              type="datetime-local"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              style={{
                display: 'block',
                marginTop: 4,
                padding: '8px 10px',
                borderRadius: 4,
                border: '1px solid var(--color-border)',
                fontSize: 'var(--text-sm)',
                width: '100%',
                background: 'var(--color-surface)',
                color: 'var(--color-foreground)',
              }}
            />
          </label>
        </section>

        <button
          type="button"
          onClick={handleCopyLink}
          disabled={loading}
          aria-busy={loading}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 4,
            background: 'var(--color-accent)',
            color: 'var(--color-accent-foreground)',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            marginBottom: 24,
          }}
        >
          {copiedToken === NEW_LINK_COPIED_ID ? 'Copied!' : loading ? 'Creating…' : 'Copy link'}
        </button>

        {presentations.length > 0 && (
          <section>
            <p
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                color: 'var(--color-foreground)',
                marginBottom: 12,
              }}
            >
              Presentations
            </p>
            {presentations.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-foreground)' }}>
                    {new Date(p.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-muted-foreground)',
                      marginLeft: 8,
                    }}
                  >
                    {p.openCount} view{p.openCount !== 1 ? 's' : ''}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: p.isRevoked
                        ? 'var(--color-muted-foreground)'
                        : 'var(--color-success, var(--color-accent))',
                      marginLeft: 8,
                    }}
                  >
                    {p.isRevoked ? 'Inactive' : 'Active'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => void handleCopyExistingLink(p.token)}
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-accent)',
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                    }}
                  >
                    {copiedToken === p.token ? 'Copied!' : 'Copy link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSetActive(p.id, p.isRevoked)}
                    disabled={loading}
                    aria-busy={loading}
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: p.isRevoked ? 'var(--color-accent)' : 'var(--color-danger)',
                      border: 'none',
                      background: 'none',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      padding: '4px 8px',
                    }}
                  >
                    {p.isRevoked ? 'Activate' : 'Deactivate'}
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
