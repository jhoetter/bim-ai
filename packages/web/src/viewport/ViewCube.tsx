import {
  type CSSProperties,
  type JSX,
  type KeyboardEvent,
  useCallback,
  useRef,
  useState,
} from 'react';
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
 * top corners are clickable (snap camera to that alignment). The cube
 * also supports drag-to-orbit: dragging anywhere on the stage orbits
 * the main camera live via the `onDrag` callback.
 *
 * The cube tracks the camera's full pose (azimuth + elevation) rather
 * than only azimuth, so it mirrors the scene orientation exactly.
 */

export interface ViewCubeProps {
  currentAzimuth: number;
  /** Camera elevation in radians (0 = horizontal, π/2 = straight down). */
  currentElevation: number;
  onPick: (pick: ViewCubePick, alignment: ViewCubeAlignment) => void;
  /** Raw pixel deltas during a drag. Viewport calls rig.orbit(dx, dy). */
  onDrag?: (dxPx: number, dyPx: number) => void;
  onHome?: () => void;
  /** Optional className for positioning. */
  className?: string;
}

const CUBE_SIZE_PX = 80;
const HALF = CUBE_SIZE_PX / 2;
const DRAG_THRESHOLD_PX = 4;

const TOP_CORNERS: { id: ViewCubeCorner; left: string; top: string }[] = [
  { id: 'TOP-NW', left: '6%', top: '6%' },
  { id: 'TOP-NE', left: '94%', top: '6%' },
  { id: 'TOP-SW', left: '6%', top: '94%' },
  { id: 'TOP-SE', left: '94%', top: '94%' },
];

interface FaceDef {
  id: ViewCubeFace;
  label: string;
  transform: string;
  /** Fraction of --color-foreground mixed into --color-surface (0–1). */
  shade: number;
}

const FACES: FaceDef[] = [
  { id: 'FRONT', label: 'FRONT', transform: `rotateY(0deg) translateZ(${HALF}px)`, shade: 0.04 },
  { id: 'BACK', label: 'BACK', transform: `rotateY(180deg) translateZ(${HALF}px)`, shade: 0.12 },
  { id: 'RIGHT', label: 'RIGHT', transform: `rotateY(90deg) translateZ(${HALF}px)`, shade: 0.08 },
  { id: 'LEFT', label: 'LEFT', transform: `rotateY(-90deg) translateZ(${HALF}px)`, shade: 0.08 },
  { id: 'TOP', label: 'TOP', transform: `rotateX(90deg) translateZ(${HALF}px)`, shade: 0.0 },
  {
    id: 'BOTTOM',
    label: 'BTM',
    transform: `rotateX(-90deg) translateZ(${HALF}px)`,
    shade: 0.22,
  },
];

export function ViewCube({
  currentAzimuth,
  currentElevation,
  onPick,
  onDrag,
  onHome,
  className,
}: ViewCubeProps): JSX.Element {
  const dragRef = useRef({ dragging: false, totalMoved: 0 });
  const suppressNextClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

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

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      dragRef.current = { dragging: true, totalMoved: 0 };
      setIsDragging(true);
      document.body.style.cursor = 'grabbing';

      const onMove = (ev: PointerEvent) => {
        const dx = ev.movementX;
        const dy = ev.movementY;
        dragRef.current.totalMoved += Math.abs(dx) + Math.abs(dy);
        onDrag?.(dx, dy);
      };

      const onUp = () => {
        if (dragRef.current.totalMoved > DRAG_THRESHOLD_PX) {
          suppressNextClickRef.current = true;
        }
        dragRef.current.dragging = false;
        setIsDragging(false);
        document.body.style.cursor = '';
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [onDrag],
  );

  const handleClickCapture = useCallback((e: React.MouseEvent) => {
    if (suppressNextClickRef.current) {
      e.stopPropagation();
      suppressNextClickRef.current = false;
    }
  }, []);

  // Cube orientation mirrors camera exactly: azimuth = horizontal rotation,
  // elevation = vertical tilt. The -elevation maps camera look-direction to
  // cube top-down rotation (elevation=0 → see front face, elevation=π/2 → see top face).
  const azimuthDeg = (-currentAzimuth * 180) / Math.PI;
  const elevationDeg = (currentElevation * 180) / Math.PI;

  const stageStyle: CSSProperties = {
    perspective: '320px',
    width: CUBE_SIZE_PX,
    height: CUBE_SIZE_PX,
    position: 'relative',
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const cubeStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    transformStyle: 'preserve-3d',
    transform: `rotateX(${-elevationDeg}deg) rotateY(${azimuthDeg}deg)`,
    transition: isDragging ? 'none' : 'transform var(--motion-slow) var(--ease-snap)',
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
        {/* Stage: drag here to orbit; click a face/corner to snap. */}
        <div
          data-testid="view-cube-stage"
          style={stageStyle}
          onPointerDown={handlePointerDown}
          onClickCapture={handleClickCapture}
        >
          <div style={cubeStyle} data-cube-stage="true">
            {FACES.map((face) => (
              <CubeFace
                key={face.id}
                face={face}
                onClick={() => emit({ kind: 'face', face: face.id })}
              />
            ))}
          </div>

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
          title="Drag cube to orbit · click face to align · click ↺ to reset"
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
  const bgColor =
    face.shade === 0
      ? 'var(--color-surface)'
      : `color-mix(in srgb, var(--color-surface) ${Math.round((1 - face.shade) * 100)}%, var(--color-foreground) ${Math.round(face.shade * 100)}%)`;

  const style: CSSProperties = {
    position: 'absolute',
    inset: 0,
    transform: face.transform,
    background: bgColor,
    border: '1px solid var(--color-border)',
    color: 'var(--color-foreground)',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.08em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'grab',
    backfaceVisibility: 'hidden',
    boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--color-border) 60%, transparent)',
    userSelect: 'none',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Align camera to ${face.id}`}
      data-face={face.id}
      style={style}
      className="hover:brightness-110"
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
