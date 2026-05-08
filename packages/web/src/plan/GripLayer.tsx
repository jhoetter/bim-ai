/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
/**
 * EDT-01 — grip + temp-dimension overlay.
 *
 * 2D HTML/SVG overlay rendered above the Three.js canvas. The grip
 * shapes (square / circle / arrow) sit on top of the elements; the
 * temp-dimension layer paints faint blue lines toward the nearest
 * neighbours with a small lock chip. Pure presentational — pointer
 * handlers are passed in by `PlanCanvas`.
 */
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';

import type { GripDescriptor } from './gripProtocol';
import type { TempDimTarget } from './tempDimensions';

export interface ScreenPoint {
  pxX: number;
  pxY: number;
}

export interface GripLayerProps {
  grips: GripDescriptor[];
  worldToScreen: (xy: { xMm: number; yMm: number }) => ScreenPoint;
  onGripPointerDown: (
    grip: GripDescriptor,
    ev: ReactMouseEvent<HTMLDivElement> | PointerEvent,
  ) => void;
  /** Live draft preview while a wall grip is being dragged. */
  draftWall?: { start: { xMm: number; yMm: number }; end: { xMm: number; yMm: number } } | null;
  /** Active grip id — paints a slightly emphasised handle so the user
   *  can see which grip is being dragged. */
  activeGripId?: string | null;
}

const GRIP_PX = 12;

function gripStyle(
  pos: ScreenPoint,
  shape: GripDescriptor['shape'],
  active: boolean,
): CSSProperties {
  const half = GRIP_PX / 2;
  const base: CSSProperties = {
    position: 'absolute',
    left: pos.pxX - half,
    top: pos.pxY - half,
    width: GRIP_PX,
    height: GRIP_PX,
    pointerEvents: 'auto',
    cursor: shape === 'arrow' ? 'ew-resize' : 'grab',
    background: active ? 'rgba(252,211,77,0.35)' : 'rgba(252,211,77,0.15)',
    border: '1.5px solid #fcd34d',
    boxSizing: 'border-box',
    touchAction: 'none',
  };
  if (shape === 'circle') {
    base.borderRadius = '50%';
  }
  if (shape === 'arrow') {
    // Diamond — distinguishes it from the squares without a sprite.
    base.transform = 'rotate(45deg)';
  }
  return base;
}

export function GripLayer({
  grips,
  worldToScreen,
  onGripPointerDown,
  draftWall,
  activeGripId,
}: GripLayerProps) {
  if (grips.length === 0 && !draftWall) return null;
  return (
    <div
      data-testid="grip-layer"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {draftWall && (
        <DraftWallPreview
          start={worldToScreen(draftWall.start)}
          end={worldToScreen(draftWall.end)}
        />
      )}
      {grips.map((g) => {
        const pos = worldToScreen(g.positionMm);
        return (
          <div
            key={g.id}
            data-testid={`grip-${g.id}`}
            data-grip-shape={g.shape}
            data-grip-axis={g.axis}
            title={g.hint ?? g.id}
            style={gripStyle(pos, g.shape, activeGripId === g.id)}
            onPointerDown={(ev) => {
              ev.stopPropagation();
              onGripPointerDown(g, ev);
            }}
          />
        );
      })}
    </div>
  );
}

function DraftWallPreview({ start, end }: { start: ScreenPoint; end: ScreenPoint }) {
  const minX = Math.min(start.pxX, end.pxX) - 4;
  const minY = Math.min(start.pxY, end.pxY) - 4;
  const maxX = Math.max(start.pxX, end.pxX) + 4;
  const maxY = Math.max(start.pxY, end.pxY) + 4;
  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  return (
    <svg
      data-testid="grip-draft-preview"
      style={{ position: 'absolute', left: minX, top: minY, pointerEvents: 'none' }}
      width={w}
      height={h}
      viewBox={`${minX} ${minY} ${w} ${h}`}
    >
      <line
        x1={start.pxX}
        y1={start.pxY}
        x2={end.pxX}
        y2={end.pxY}
        stroke="#fcd34d"
        strokeWidth={2}
        strokeDasharray="6 4"
      />
    </svg>
  );
}

/* ─── Temp-dimension layer ────────────────────────────────────────── */

export interface TempDimLayerProps {
  targets: TempDimTarget[];
  worldToScreen: (xy: { xMm: number; yMm: number }) => ScreenPoint;
  onTargetClick: (target: TempDimTarget) => void;
  onLockClick: (target: TempDimTarget) => void;
  /** EDT-02 — predicate returning whether the target already has a
   *  matching `ConstraintElem` in the world. Drives the open- vs
   *  filled-padlock glyph swap. */
  isLocked?: (target: TempDimTarget) => boolean;
}

function formatMm(mm: number): string {
  if (mm >= 1000) return `${(mm / 1000).toFixed(2)} m`;
  return `${Math.round(mm)} mm`;
}

export function TempDimLayer({
  targets,
  worldToScreen,
  onTargetClick,
  onLockClick,
  isLocked,
}: TempDimLayerProps) {
  if (targets.length === 0) return null;
  return (
    <div
      data-testid="temp-dim-layer"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      {targets.map((t) => {
        const a = worldToScreen(t.fromMm);
        const b = worldToScreen(t.toMm);
        const cx = (a.pxX + b.pxX) / 2;
        const cy = (a.pxY + b.pxY) / 2;
        const minX = Math.min(a.pxX, b.pxX) - 24;
        const minY = Math.min(a.pxY, b.pxY) - 24;
        const maxX = Math.max(a.pxX, b.pxX) + 24;
        const maxY = Math.max(a.pxY, b.pxY) + 24;
        const w = Math.max(1, maxX - minX);
        const h = Math.max(1, maxY - minY);
        return (
          <div key={t.id} data-testid={`temp-dim-${t.id}`}>
            <svg
              style={{
                position: 'absolute',
                left: minX,
                top: minY,
                pointerEvents: 'none',
              }}
              width={w}
              height={h}
              viewBox={`${minX} ${minY} ${w} ${h}`}
            >
              <line
                x1={a.pxX}
                y1={a.pxY}
                x2={b.pxX}
                y2={b.pxY}
                stroke="#7dd3fc"
                strokeOpacity={0.55}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
            </svg>
            <button
              type="button"
              data-testid={`temp-dim-readout-${t.id}`}
              onClick={() => onTargetClick(t)}
              style={{
                position: 'absolute',
                left: cx - 30,
                top: cy - 10,
                width: 60,
                height: 20,
                pointerEvents: 'auto',
                cursor: 'pointer',
                background: 'rgba(20,28,42,0.75)',
                color: '#7dd3fc',
                fontSize: 10,
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
                border: '1px solid rgba(125,211,252,0.4)',
                borderRadius: 3,
              }}
              title="Click to convert to a persistent dimension"
            >
              {formatMm(t.distanceMm)}
            </button>
            {(() => {
              const locked = isLocked ? isLocked(t) : false;
              return (
                <button
                  type="button"
                  data-testid={`temp-dim-lock-${t.id}`}
                  data-locked={locked ? 'true' : 'false'}
                  onClick={() => onLockClick(t)}
                  style={{
                    position: 'absolute',
                    left: cx + 32,
                    top: cy - 10,
                    width: 18,
                    height: 18,
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    background: locked ? 'rgba(252,211,77,0.85)' : 'rgba(20,28,42,0.75)',
                    color: locked ? '#0b1220' : '#7dd3fc',
                    fontSize: 11,
                    border: locked
                      ? '1px solid rgba(252,211,77,0.9)'
                      : '1px solid rgba(125,211,252,0.4)',
                    borderRadius: 3,
                    lineHeight: '15px',
                    padding: 0,
                  }}
                  title={locked ? 'Locked distance — click again is a no-op' : 'Lock this distance'}
                  aria-label={locked ? 'Locked dimension' : 'Lock dimension'}
                >
                  {locked ? '🔒' : '🔓'}
                </button>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
