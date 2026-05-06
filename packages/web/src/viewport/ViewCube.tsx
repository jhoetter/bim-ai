import { type CSSProperties, type JSX, type KeyboardEvent } from 'react';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import {
  alignmentForPick,
  compassLabelFromAzimuth,
  type ViewCubeAlignment,
  type ViewCubeCorner,
  type ViewCubeFace,
  type ViewCubePick,
} from './viewCubeAlignment';

/**
 * ViewCube widget — spec §15.4.
 *
 * 96 × 96 px CSS-3D cube sitting top-right of the 3D canvas. Faces +
 * top corners are pickable. The cube rotates to mirror the live
 * camera's azimuth (passed in via `currentAzimuth`) so the viewer
 * always sees the cube oriented like the scene below.
 *
 * This implementation uses CSS `transform-style: preserve-3d` rather
 * than a second Three.js renderer — it ships in ~1.5 kB instead of
 * the ~120 kB cost of bringing up a tiny WebGL context for a 96 px
 * widget.
 */

export interface ViewCubeProps {
  currentAzimuth: number;
  onPick: (pick: ViewCubePick, alignment: ViewCubeAlignment) => void;
  onHome?: () => void;
  /** Optional className for positioning. */
  className?: string;
}

const CUBE_SIZE_PX = 80;
const HALF = CUBE_SIZE_PX / 2;
const TILT_DEG = 25; // looking slightly down at the cube
// Corner picks (top of cube). Bottom corners are not exposed in the
// chrome — viewers don't typically want to look up at scenes.
const TOP_CORNERS: { id: ViewCubeCorner; left: string; top: string }[] = [
  { id: 'TOP-NW', left: '6%', top: '6%' },
  { id: 'TOP-NE', left: '94%', top: '6%' },
  { id: 'TOP-SW', left: '6%', top: '94%' },
  { id: 'TOP-SE', left: '94%', top: '94%' },
];

interface FaceDef {
  id: ViewCubeFace;
  label: string;
  /** Transform that places the face on the cube. */
  transform: string;
}

const FACES: FaceDef[] = [
  { id: 'FRONT', label: 'FRONT', transform: `rotateY(0deg) translateZ(${HALF}px)` },
  { id: 'BACK', label: 'BACK', transform: `rotateY(180deg) translateZ(${HALF}px)` },
  { id: 'RIGHT', label: 'RIGHT', transform: `rotateY(90deg) translateZ(${HALF}px)` },
  { id: 'LEFT', label: 'LEFT', transform: `rotateY(-90deg) translateZ(${HALF}px)` },
  { id: 'TOP', label: 'TOP', transform: `rotateX(90deg) translateZ(${HALF}px)` },
  { id: 'BOTTOM', label: 'BOTTOM', transform: `rotateX(-90deg) translateZ(${HALF}px)` },
];

export function ViewCube({
  currentAzimuth,
  onPick,
  onHome,
  className,
}: ViewCubeProps): JSX.Element {
  function emit(pick: ViewCubePick): void {
    onPick(pick, alignmentForPick(pick));
  }

  function handleKey(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      emit({ kind: 'home' });
      onHome?.();
    }
  }

  // Cube rotates so its FRONT faces the viewer based on currentAzimuth.
  // Three.js azimuth: 0 = +Z, π/2 = +X. CSS rotateY rotates clockwise
  // looking from +Y down. Negate so the cube tracks scene rotation.
  const azimuthDeg = (-currentAzimuth * 180) / Math.PI;
  const stageStyle: CSSProperties = {
    perspective: '320px',
    width: CUBE_SIZE_PX,
    height: CUBE_SIZE_PX,
    position: 'relative',
  };
  const cubeStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    transformStyle: 'preserve-3d',
    transform: `rotateX(${-TILT_DEG}deg) rotateY(${azimuthDeg}deg)`,
    transition: 'transform var(--motion-slow) var(--ease-snap)',
  };

  return (
    <div
      data-testid="view-cube"
      role="group"
      aria-label="ViewCube"
      onKeyDown={handleKey}
      className={['flex flex-col items-end gap-1.5', className ?? ''].join(' ')}
    >
      <div className="flex items-start gap-2">
        <div style={stageStyle}>
          <div style={cubeStyle} data-cube-stage="true">
            {FACES.map((face) => (
              <CubeFace key={face.id} face={face} onClick={() => emit({ kind: 'face', face: face.id })} />
            ))}
          </div>
          {/* Top-corner pick zones — overlay the cube stage. Hover-only,
           * picks emit corner alignments (NE-Iso etc.). */}
          {TOP_CORNERS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => emit({ kind: 'corner', corner: c.id })}
              aria-label={`Align camera to ${c.id}`}
              data-corner={c.id}
              style={{
                position: 'absolute',
                left: c.left,
                top: c.top,
                transform: 'translate(-50%, -50%)',
                width: 14,
                height: 14,
                borderRadius: 7,
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                cursor: 'pointer',
                opacity: 0.85,
                padding: 0,
              }}
              className="hover:bg-surface-strong"
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            emit({ kind: 'home' });
            onHome?.();
          }}
          aria-label="Reset to default view"
          title="Click face to align camera; corners pick isos; double-click home for default view."
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-foreground shadow-elev-2 hover:bg-surface-strong"
        >
          <Icons.viewCubeReset size={ICON_SIZE.chrome} aria-hidden="true" />
        </button>
      </div>
      <Compass currentAzimuth={currentAzimuth} />
    </div>
  );
}

function CubeFace({ face, onClick }: { face: FaceDef; onClick: () => void }): JSX.Element {
  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    transform: face.transform,
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-foreground)',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.06em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    backfaceVisibility: 'hidden',
    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-border) 60%, transparent)',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Align camera to ${face.label}`}
      data-face={face.id}
      style={style}
      className="hover:!bg-surface-strong"
    >
      {face.label}
    </button>
  );
}

function Compass({ currentAzimuth }: { currentAzimuth: number }): JSX.Element {
  const label = compassLabelFromAzimuth(currentAzimuth);
  return (
    <div
      role="img"
      aria-label={`Compass · north toward ${label}`}
      data-testid="view-cube-compass"
      data-cardinal={label}
      className="flex items-center gap-1 rounded-pill border border-border bg-surface px-2 py-0.5 text-xs"
    >
      <span aria-hidden="true">⌖</span>
      <span className="font-medium">{label}</span>
    </div>
  );
}
