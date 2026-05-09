/**
 * IMG-V3-01 — Image trace drop zone.
 *
 * Accepts .png, .jpg, .jpeg, .pdf via drag-and-drop or file picker.
 * Posts to POST /api/v3/trace; handles inline StructuredLayout responses
 * and { jobId } responses from the JOB-V3-01 queue.
 * On completion, renders a side-by-side preview: source image on the left,
 * SVG render of detected walls/rooms on the right.
 *
 * No hex literals — all colours via CSS token variables.
 */

import { useCallback, useEffect, useRef, useState, type JSX } from 'react';

import type { Advisory, StructuredLayout } from '@bim-ai/core';

const BASE = `${window.location.protocol}//${window.location.host}`;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
const ACCEPTED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.pdf'];
const POLL_INTERVAL_MS = 1500;

type TraceState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'polling'; jobId: string }
  | { phase: 'done'; layout: StructuredLayout; imageUrl: string }
  | { phase: 'error'; message: string };

export type ImageTraceDropZoneProps = {
  archetypeHint?: string;
  onLayout?: (layout: StructuredLayout) => void;
};

export function ImageTraceDropZone({
  archetypeHint,
  onLayout,
}: ImageTraceDropZoneProps): JSX.Element {
  const [state, setState] = useState<TraceState>({ phase: 'idle' });
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(
    (jobId: string, imageUrl: string) => {
      const poll = async () => {
        try {
          const res = await fetch(`${BASE}/api/jobs/${encodeURIComponent(jobId)}`);
          if (!res.ok) return;
          const job = await res.json();
          if (job.status === 'done') {
            stopPolling();
            const layout = job.outputs?.layout as StructuredLayout | undefined;
            if (layout) {
              setState({ phase: 'done', layout, imageUrl });
              onLayout?.(layout);
            } else {
              setState({ phase: 'error', message: 'Job completed but no layout in outputs' });
            }
          } else if (job.status === 'errored') {
            stopPolling();
            setState({ phase: 'error', message: job.errorMessage ?? 'Job errored' });
          } else {
            pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
          }
        } catch {
          pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
        }
      };
      pollRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    },
    [onLayout, stopPolling],
  );

  const postTrace = useCallback(
    async (file: File) => {
      setState({ phase: 'uploading' });
      const imageUrl = URL.createObjectURL(file);

      const form = new FormData();
      form.append('image', file, file.name);

      const url = archetypeHint
        ? `${BASE}/api/v3/trace?archetypeHint=${encodeURIComponent(archetypeHint)}`
        : `${BASE}/api/v3/trace`;

      let res: Response;
      try {
        res = await fetch(url, { method: 'POST', body: form });
      } catch (e) {
        setState({ phase: 'error', message: String(e) });
        return;
      }

      const text = await res.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text);
      } catch {
        setState({ phase: 'error', message: `Non-JSON response: ${text.slice(0, 200)}` });
        return;
      }

      if (!res.ok) {
        const detail = json?.detail as Record<string, unknown> | undefined;
        const layout = detail?.layout as StructuredLayout | undefined;
        if (layout) {
          setState({ phase: 'done', layout, imageUrl });
          onLayout?.(layout);
        } else {
          setState({
            phase: 'error',
            message: `Trace failed (HTTP ${res.status}): ${JSON.stringify(json)}`,
          });
        }
        return;
      }

      if (typeof json.jobId === 'string') {
        setState({ phase: 'polling', jobId: json.jobId });
        startPolling(json.jobId, imageUrl);
        return;
      }

      const layout = json as unknown as StructuredLayout;
      setState({ phase: 'done', layout, imageUrl });
      onLayout?.(layout);
    },
    [archetypeHint, onLayout, startPolling],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && isAccepted(file)) void postTrace(file);
    },
    [postTrace],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void postTrace(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [postTrace],
  );

  return (
    <div style={containerStyle}>
      {state.phase === 'idle' || state.phase === 'error' ? (
        <div
          style={{
            ...dropZoneStyle,
            borderColor: dragging ? 'var(--color-focus)' : 'var(--color-border-strong)',
            background: dragging ? 'var(--color-surface-hover)' : 'var(--color-surface)',
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
          }}
          aria-label="Drop a floor plan image here or click to select"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <span style={{ color: 'var(--color-muted-foreground)', fontSize: 14 }}>
            {state.phase === 'error'
              ? `Error: ${state.message}`
              : 'Drop a floor plan image here or click to trace'}
          </span>
        </div>
      ) : state.phase === 'uploading' ? (
        <div style={statusStyle}>
          <span style={{ color: 'var(--color-muted-foreground)' }}>Tracing…</span>
        </div>
      ) : state.phase === 'polling' ? (
        <div style={statusStyle}>
          <span style={{ color: 'var(--color-muted-foreground)' }}>
            Tracing (job {state.jobId.slice(0, 8)}…)
          </span>
        </div>
      ) : (
        <TracePreview layout={state.layout} imageUrl={state.imageUrl} />
      )}
    </div>
  );
}

function isAccepted(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))
  );
}

type TracePreviewProps = {
  layout: StructuredLayout;
  imageUrl: string;
};

function TracePreview({ layout, imageUrl }: TracePreviewProps): JSX.Element {
  const { widthPx, heightPx } = layout.imageMetadata;
  const scale = widthPx > 0 && heightPx > 0 ? 300 / widthPx : 1;
  const svgW = widthPx * scale;
  const svgH = heightPx * scale;
  const mmPerPx = layout.imageMetadata.calibrationMmPerPx ?? 1;

  function mmToSvg(mm: number): number {
    return (mm / mmPerPx) * scale;
  }

  const advisoryCodes = layout.advisories.map((a: Advisory) => a.code);

  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}>Source image</span>
        <img
          src={imageUrl}
          alt="Source floor plan"
          style={{ width: svgW, height: svgH, objectFit: 'contain', display: 'block' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}>
          Detected layout ({layout.walls.length} walls, {layout.rooms.length} rooms)
        </span>
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ display: 'block', border: '1px solid var(--color-border)' }}
          aria-label="Detected layout"
        >
          {layout.rooms.map((room) => {
            const pts = room.polygonMm.map((p) => `${mmToSvg(p.x)},${mmToSvg(p.y)}`).join(' ');
            return (
              <polygon
                key={room.id}
                points={pts}
                fill="var(--color-surface-strong)"
                fillOpacity={0.15}
                stroke="none"
              />
            );
          })}
          {layout.walls.map((wall) => (
            <line
              key={wall.id}
              x1={mmToSvg(wall.aMm.x)}
              y1={mmToSvg(wall.aMm.y)}
              x2={mmToSvg(wall.bMm.x)}
              y2={mmToSvg(wall.bMm.y)}
              stroke="var(--draft-lw-cut-major)"
              strokeWidth={1.5}
            />
          ))}
        </svg>
      </div>

      {advisoryCodes.length > 0 && (
        <div style={{ width: '100%' }}>
          <ul
            style={{
              margin: 0,
              padding: 0,
              listStyle: 'none',
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {layout.advisories.map((a: Advisory) => (
              <li
                key={a.code}
                style={{
                  fontSize: 11,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'var(--color-surface-warning)',
                  color: 'var(--color-text-warning)',
                }}
              >
                {a.code}
                {a.message ? `: ${a.message}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  width: '100%',
  fontFamily: 'var(--font-sans)',
};

const dropZoneStyle: React.CSSProperties = {
  border: '2px dashed',
  borderRadius: 8,
  padding: 32,
  textAlign: 'center',
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'border-color 0.15s, background 0.15s',
};

const statusStyle: React.CSSProperties = {
  padding: 32,
  textAlign: 'center',
};
