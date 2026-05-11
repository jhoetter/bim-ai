import { useCallback, useEffect, useRef, useState } from 'react';

import type { Job } from '@bim-ai/core';

import { MAX_WS_RECONNECT_ATTEMPTS, reconnectDelayMs } from '../lib/wsReconnect';
import { useBimStore } from '../state/store';

const BASE = `${window.location.protocol}//${window.location.host}`;
const WS_BASE = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

const KIND_LABELS: Record<string, string> = {
  csg_solve: 'CSG Solve',
  ifc_export: 'IFC Export',
  dxf_import: 'DXF Import',
  gltf_export: 'glTF Export',
  sketch_trace: 'Sketch Trace',
  image_trace: 'Image Trace',
  render_still: 'Still Render',
  render_video: 'Video Render',
  agent_call: 'Agent Call',
};

function elapsed(job: Job): string {
  const start = job.startedAt
    ? new Date(job.startedAt).getTime()
    : new Date(job.createdAt).getTime();
  const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
  const secs = Math.round((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function inputsSummary(inputs: Record<string, unknown>): string {
  const keys = Object.keys(inputs);
  if (keys.length === 0) return '—';
  return keys
    .slice(0, 3)
    .map((k) => `${k}: ${JSON.stringify(inputs[k])}`)
    .join(', ');
}

function StatusIcon({ status }: { status: Job['status'] }) {
  const style: React.CSSProperties = {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
    background:
      status === 'done'
        ? 'var(--color-success)'
        : status === 'running'
          ? 'var(--color-accent)'
          : status === 'errored'
            ? 'var(--color-danger)'
            : status === 'cancelled'
              ? 'var(--color-muted-foreground)'
              : 'var(--color-warning)',
  };
  return <span style={style} title={status} />;
}

function JobRow({
  job,
  onRetry,
  onCancel,
  onExpand,
  expanded,
}: {
  job: Job;
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onExpand: (id: string) => void;
  expanded: boolean;
}) {
  return (
    <div
      style={{
        borderBottom: '1px solid var(--color-border)',
        padding: 'var(--space-2) var(--space-3)',
        cursor: 'pointer',
        background: expanded ? 'var(--color-surface-strong)' : undefined,
      }}
      onClick={() => onExpand(job.id)}
      onContextMenu={(e) => {
        e.preventDefault();
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
          font: 'var(--text-sm)',
        }}
      >
        <StatusIcon status={job.status} />
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {KIND_LABELS[job.kind] ?? job.kind}
        </span>
        <span
          style={{
            color: 'var(--color-muted-foreground)',
            fontSize: 'var(--text-xs)',
            flexShrink: 0,
          }}
        >
          {elapsed(job)}
        </span>
      </div>
      <div
        style={{
          marginTop: 'var(--space-1)',
          color: 'var(--color-muted-foreground)',
          fontSize: 'var(--text-xs)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {inputsSummary(job.inputs)}
      </div>
      {expanded && (
        <div style={{ marginTop: 'var(--space-2)', fontSize: 'var(--text-xs)' }}>
          {job.errorMessage && (
            <div style={{ color: 'var(--color-danger)', marginBottom: 'var(--space-1)' }}>
              {job.errorMessage}
            </div>
          )}
          {job.parentJobId && (
            <div style={{ color: 'var(--color-muted-foreground)', marginBottom: 'var(--space-1)' }}>
              Retry of: {job.parentJobId.slice(0, 8)}…
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
            {(job.status === 'done' || job.status === 'errored' || job.status === 'cancelled') && (
              <button
                type="button"
                style={{ fontSize: 'var(--text-xs)', cursor: 'pointer' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry(job.id);
                }}
              >
                Retry
              </button>
            )}
            {(job.status === 'queued' || job.status === 'running') && (
              <button
                type="button"
                style={{
                  fontSize: 'var(--text-xs)',
                  cursor: 'pointer',
                  color: 'var(--color-danger)',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel(job.id);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function JobsPanel() {
  const modelId = useBimStore((s) => s.modelId);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchJobs = useCallback(async () => {
    if (!modelId) return;
    try {
      const res = await fetch(`${BASE}/api/jobs?modelId=${encodeURIComponent(modelId)}`);
      if (!res.ok) return;
      const data = (await res.json()) as Job[];
      setJobs(data.slice().reverse());
    } catch {
      // best-effort
    }
  }, [modelId]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (!modelId) return;

    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(`${WS_BASE}/ws/${encodeURIComponent(modelId)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(String(evt.data)) as Record<string, unknown>;
          if (payload.type === 'job_update') {
            const updated = payload.job as Job;
            setJobs((prev) => {
              const idx = prev.findIndex((j) => j.id === updated.id);
              if (idx === -1) return [updated, ...prev];
              const next = [...prev];
              next[idx] = updated;
              return next;
            });
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
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
  }, [modelId]);

  const handleRetry = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${BASE}/api/jobs/${encodeURIComponent(jobId)}/retry`, {
        method: 'POST',
      });
      if (res.ok) {
        const newJob = (await res.json()) as Job;
        setJobs((prev) => [newJob, ...prev]);
      }
    } catch {
      // best-effort
    }
  }, []);

  const handleCancel = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`${BASE}/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
        method: 'POST',
      });
      if (res.ok) {
        const updated = (await res.json()) as Job;
        setJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
      }
    } catch {
      // best-effort
    }
  }, []);

  const handleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div
      style={{
        width: 320,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--color-surface)',
        borderLeft: '1px solid var(--color-border)',
        fontFamily: 'var(--font-sans)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: 'var(--space-2) var(--space-3)',
          borderBottom: '1px solid var(--color-border)',
          font: 'var(--text-sm)',
          color: 'var(--color-foreground)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span>Jobs</span>
        <span style={{ color: 'var(--color-muted-foreground)', fontSize: 'var(--text-xs)' }}>
          {jobs.length}
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {jobs.length === 0 && (
          <div
            style={{
              padding: 'var(--space-5)',
              textAlign: 'center',
              color: 'var(--color-muted-foreground)',
              fontSize: 'var(--text-sm)',
            }}
          >
            No jobs yet
          </div>
        )}
        {jobs.map((job) => (
          <JobRow
            key={job.id}
            job={job}
            expanded={expandedId === job.id}
            onRetry={handleRetry}
            onCancel={handleCancel}
            onExpand={handleExpand}
          />
        ))}
      </div>
    </div>
  );
}
