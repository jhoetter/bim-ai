/**
 * SKT-01 — Sketch authoring overlay (floor-only load-bearing slice).
 *
 * Mounts as an absolute overlay above `PlanCanvas` while a sketch session is
 * open. Renders the in-progress sketch as turquoise lines (Revit convention),
 * shows the validation status, and exposes Line / Rectangle drawing modes plus
 * Finish ✓ / Cancel ✗ controls. Esc cancels.
 *
 * Coordinate mapping is delegated to two callback refs supplied by the parent
 * canvas — that way we don't reimplement the orthographic camera math and stay
 * in sync with pan / zoom automatically.
 */

import {
  type CSSProperties,
  type JSX,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  type SketchSessionWire,
  type SketchValidationState,
  addSketchLine,
  cancelSketchSession,
  finishSketchSession,
  getSketchSession,
  openSketchSession,
} from './sketchApi';

const TURQUOISE = '#3fc5d3';
const TURQUOISE_FAINT = 'rgba(63, 197, 211, 0.45)';
const VERTEX_FILL = '#0e8b9c';

export type Point2D = { xMm: number; yMm: number };

export type PointerToMm = (clientX: number, clientY: number) => Point2D | null;
export type MmToScreen = (pt: Point2D) => { x: number; y: number } | null;

export type SketchTool = 'line' | 'rectangle';

export interface SketchCanvasProps {
  modelId: string;
  levelId: string;
  /** Optional pre-existing session id; when present we hydrate it instead of opening fresh. */
  sessionId?: string;
  /** Read-only refs that read live camera state from the parent canvas. */
  pointerToMmRef: RefObject<PointerToMm | null>;
  mmToScreenRef: RefObject<MmToScreen | null>;
  /** Called when the user finishes the session and a CreateFloor commits. */
  onFinished: (floorId: string | null) => void;
  /** Called on cancel (Esc, ✗ button, or session error). */
  onCancelled: () => void;
}

function snapMm(p: Point2D, snapMmGrid: number): Point2D {
  return {
    xMm: Math.round(p.xMm / snapMmGrid) * snapMmGrid,
    yMm: Math.round(p.yMm / snapMmGrid) * snapMmGrid,
  };
}

function statusMessage(validation: SketchValidationState | null): string {
  if (!validation) return 'Sketching…';
  if (validation.valid) return 'Ready to Finish';
  const issue = validation.issues[0];
  if (!issue) return 'Sketching…';
  return issue.message;
}

export function SketchCanvas(props: SketchCanvasProps): JSX.Element {
  const {
    modelId,
    levelId,
    pointerToMmRef,
    mmToScreenRef,
    onFinished,
    onCancelled,
    sessionId: initialSessionId,
  } = props;
  const [session, setSession] = useState<SketchSessionWire | null>(null);
  const [validation, setValidation] = useState<SketchValidationState | null>(null);
  const [tool, setTool] = useState<SketchTool>('line');
  const [pendingStart, setPendingStart] = useState<Point2D | null>(null);
  const [hover, setHover] = useState<Point2D | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  // Tick to force re-render on pointer move so SVG vertices reflect pan / zoom.
  const [, setTick] = useState(0);

  // Open or hydrate a session on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = initialSessionId
          ? await getSketchSession(initialSessionId)
          : await openSketchSession(modelId, levelId);
        if (cancelled) return;
        setSession(resp.session);
        setValidation(resp.validation);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          onCancelled();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modelId, levelId, initialSessionId, onCancelled]);

  const handleCancel = useCallback(async () => {
    if (!session) {
      onCancelled();
      return;
    }
    try {
      setBusy(true);
      await cancelSketchSession(session.sessionId);
    } catch {
      // Cancel failures shouldn't block the UX; we drop the overlay regardless.
    } finally {
      setBusy(false);
      onCancelled();
    }
  }, [session, onCancelled]);

  // Esc cancels; L / R switch tools.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void handleCancel();
      } else if (e.key.toLowerCase() === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setTool('line');
        setPendingStart(null);
      } else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setTool('rectangle');
        setPendingStart(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleCancel]);

  const handlePointerDown = useCallback(
    async (e: React.PointerEvent<HTMLDivElement>) => {
      if (!session || session.status !== 'open' || busy) return;
      const ptMm = pointerToMmRef.current?.(e.clientX, e.clientY);
      if (!ptMm) return;
      const snapped = snapMm(ptMm, 100);

      if (tool === 'line') {
        if (pendingStart === null) {
          setPendingStart(snapped);
          return;
        }
        try {
          setBusy(true);
          const resp = await addSketchLine(session.sessionId, pendingStart, snapped);
          setSession(resp.session);
          setValidation(resp.validation);
          // Chain mode: next click extends from the line just placed.
          setPendingStart(snapped);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      } else if (tool === 'rectangle') {
        if (pendingStart === null) {
          setPendingStart(snapped);
          return;
        }
        const a = pendingStart;
        const c = snapped;
        const corners: Point2D[] = [
          { xMm: a.xMm, yMm: a.yMm },
          { xMm: c.xMm, yMm: a.yMm },
          { xMm: c.xMm, yMm: c.yMm },
          { xMm: a.xMm, yMm: c.yMm },
        ];
        try {
          setBusy(true);
          let resp = await addSketchLine(session.sessionId, corners[0]!, corners[1]!);
          resp = await addSketchLine(session.sessionId, corners[1]!, corners[2]!);
          resp = await addSketchLine(session.sessionId, corners[2]!, corners[3]!);
          resp = await addSketchLine(session.sessionId, corners[3]!, corners[0]!);
          setSession(resp.session);
          setValidation(resp.validation);
          setPendingStart(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }
    },
    [session, busy, pointerToMmRef, tool, pendingStart],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const ptMm = pointerToMmRef.current?.(e.clientX, e.clientY);
      if (!ptMm) return;
      setHover(snapMm(ptMm, 100));
      setTick((t) => (t + 1) % 1_000_000);
    },
    [pointerToMmRef],
  );

  const handleFinish = useCallback(async () => {
    if (!session || busy) return;
    try {
      setBusy(true);
      const resp = await finishSketchSession(session.sessionId);
      onFinished(resp.floorId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [session, busy, onFinished]);

  // Compute SVG primitives for current session lines + preview.
  const linesSvg: JSX.Element[] = [];
  const verticesSvg: JSX.Element[] = [];
  const mmToScreen = mmToScreenRef.current;
  if (mmToScreen && session) {
    for (let i = 0; i < session.lines.length; i++) {
      const ln = session.lines[i]!;
      const a = mmToScreen(ln.fromMm);
      const b = mmToScreen(ln.toMm);
      if (!a || !b) continue;
      linesSvg.push(
        <line
          key={`l-${i}`}
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={TURQUOISE}
          strokeWidth={2}
          strokeLinecap="round"
        />,
      );
      verticesSvg.push(<circle key={`v-${i}-a`} cx={a.x} cy={a.y} r={3} fill={VERTEX_FILL} />);
      verticesSvg.push(<circle key={`v-${i}-b`} cx={b.x} cy={b.y} r={3} fill={VERTEX_FILL} />);
    }
    if (pendingStart && hover) {
      const a = mmToScreen(pendingStart);
      const b = mmToScreen(hover);
      if (a && b) {
        if (tool === 'line') {
          linesSvg.push(
            <line
              key="preview"
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={TURQUOISE_FAINT}
              strokeWidth={2}
              strokeDasharray="6 4"
            />,
          );
        } else {
          const x = Math.min(a.x, b.x);
          const y = Math.min(a.y, b.y);
          const w = Math.abs(b.x - a.x);
          const h = Math.abs(b.y - a.y);
          linesSvg.push(
            <rect
              key="preview-rect"
              x={x}
              y={y}
              width={w}
              height={h}
              fill="none"
              stroke={TURQUOISE_FAINT}
              strokeWidth={2}
              strokeDasharray="6 4"
            />,
          );
        }
      }
    }
  }

  const overlayStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    zIndex: 20,
    pointerEvents: 'auto',
    cursor: busy ? 'progress' : 'crosshair',
  };

  return (
    <div
      ref={overlayRef}
      data-testid="sketch-canvas"
      style={overlayStyle}
      onPointerDown={(e) => void handlePointerDown(e)}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        width="100%"
        height="100%"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        aria-hidden="true"
      >
        {linesSvg}
        {verticesSvg}
      </svg>

      {/* Top status bar — validation message in turquoise */}
      <div
        data-testid="sketch-status"
        style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 10px',
          borderRadius: 6,
          backgroundColor: 'rgba(15, 22, 28, 0.85)',
          color: validation?.valid ? TURQUOISE : '#fab86c',
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
          pointerEvents: 'none',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: validation?.valid ? TURQUOISE : '#fab86c',
            display: 'inline-block',
          }}
        />
        <span>{error ?? statusMessage(validation)}</span>
      </div>

      {/* Bottom-centre toolbar */}
      <div
        data-testid="sketch-toolbar"
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: 6,
          borderRadius: 8,
          backgroundColor: 'rgba(15, 22, 28, 0.92)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
        }}
      >
        <SketchToolButton
          label="Line"
          shortcut="L"
          active={tool === 'line'}
          onClick={() => {
            setTool('line');
            setPendingStart(null);
          }}
        />
        <SketchToolButton
          label="Rectangle"
          shortcut="R"
          active={tool === 'rectangle'}
          onClick={() => {
            setTool('rectangle');
            setPendingStart(null);
          }}
        />
        <div style={{ width: 1, height: 20, backgroundColor: '#33424d', margin: '0 4px' }} />
        <button
          type="button"
          data-testid="sketch-finish"
          disabled={!validation?.valid || busy}
          onClick={() => void handleFinish()}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: 'none',
            backgroundColor: validation?.valid ? TURQUOISE : '#33424d',
            color: validation?.valid ? '#0d1216' : '#7c8a93',
            fontSize: 12,
            fontWeight: 600,
            cursor: validation?.valid && !busy ? 'pointer' : 'not-allowed',
          }}
        >
          ✓ Finish
        </button>
        <button
          type="button"
          data-testid="sketch-cancel"
          onClick={() => void handleCancel()}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid #33424d',
            backgroundColor: 'transparent',
            color: '#fab86c',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ✗ Cancel
        </button>
      </div>
    </div>
  );
}

interface SketchToolButtonProps {
  label: string;
  shortcut: string;
  active: boolean;
  onClick: () => void;
}

function SketchToolButton({
  label,
  shortcut,
  active,
  onClick,
}: SketchToolButtonProps): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: '1px solid #33424d',
        backgroundColor: active ? TURQUOISE : 'transparent',
        color: active ? '#0d1216' : '#cfd6db',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      {label}
      <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7 }}>{shortcut}</span>
    </button>
  );
}
