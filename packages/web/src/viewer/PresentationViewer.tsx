import React, { useEffect, useRef, useState } from 'react';

import { MAX_WS_RECONNECT_ATTEMPTS, reconnectDelayMs } from '../lib/wsReconnect';

interface PresentationMeta {
  id: string;
  displayName?: string;
  openCount: number;
}

interface PresentationData {
  status: 'ok' | 'revoked';
  modelId?: string;
  revision?: number;
  elements?: Record<string, unknown>;
  wsUrl?: string;
  presentation?: PresentationMeta;
  allowMeasurement?: boolean;
  allowComment?: boolean;
}

interface Props {
  token: string;
}

export function PresentationViewer({ token }: Props) {
  const [data, setData] = useState<PresentationData | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/p/${token}`);
        if (!res.ok) {
          setRevoked(true);
          return;
        }
        const json: PresentationData = await res.json();
        if (cancelled) return;
        if (json.status === 'revoked') {
          setRevoked(true);
          return;
        }
        setData(json);
      } catch {
        if (!cancelled) setRevoked(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!data?.wsUrl) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${data.wsUrl}`;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string };
          if (msg.type === 'revoked') {
            setRevoked(true);
            ws.close();
          } else if (msg.type === 'snapshot_update' || msg.type === 'delta') {
            fetch(`/api/p/${token}`)
              .then((r) => r.json())
              .then((updated: PresentationData) => {
                if (updated.status !== 'revoked') {
                  setData((prev) => ({ ...prev, ...updated }));
                } else {
                  setRevoked(true);
                }
              })
              .catch(() => {});
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        if (event.code === 4403) {
          setRevoked(true);
          return;
        }
        if (cancelled) return;
        const attempt = reconnectAttemptsRef.current + 1;
        reconnectAttemptsRef.current = attempt;
        if (attempt > MAX_WS_RECONNECT_ATTEMPTS) return;
        reconnectTimerRef.current = setTimeout(connect, reconnectDelayMs(attempt));
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [data?.wsUrl, token]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'var(--color-muted-foreground)',
          fontSize: 'var(--text-sm)',
        }}
      >
        Loading presentation…
      </div>
    );
  }

  if (revoked) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          gap: 12,
          color: 'var(--color-muted-foreground)',
        }}
      >
        <p style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-foreground)', margin: 0 }}>
          Presentation revoked
        </p>
        <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
          This presentation link is no longer active.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <PresentationBanner displayName={data?.presentation?.displayName} />
      <div
        style={{
          flex: 1,
          marginTop: 32,
          position: 'relative',
          background: 'var(--color-surface)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--color-muted-foreground)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {data
            ? `Viewing model ${data.modelId} — revision ${data.revision}`
            : 'No presentation data'}
        </div>
      </div>
    </div>
  );
}

function PresentationBanner({ displayName }: { displayName?: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 32,
        background: 'var(--color-surface-2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: 'var(--text-sm)',
        zIndex: 100,
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <span style={{ color: 'var(--color-foreground)' }}>
        {displayName ? `Shared by ${displayName}` : 'Live presentation (read-only)'}
      </span>
      <a
        href="/login"
        style={{
          color: 'var(--color-accent)',
          textDecoration: 'none',
          fontSize: 'var(--text-sm)',
        }}
      >
        Sign in to edit →
      </a>
    </div>
  );
}
