import { type CSSProperties, type JSX, type KeyboardEvent } from 'react';
import { Icons, ICON_SIZE } from '@bim-ai/ui';
import {
  alignmentForPick,
  compassLabelFromAzimuth,
  type ViewCubeAlignment,
  type ViewCubeFace,
  type ViewCubePick,
} from './viewCubeAlignment';

/**
 * ViewCube widget — spec §15.4.
 *
 * 96 × 96 px square sitting top-right of the 3D canvas. Faces, edges, and
 * corners are pickable; clicking emits a normalized `ViewCubePick`. A
 * dedicated `Home` button to the right snaps to the saved default view
 * (mirrors a double-click on the cube center). Compass ring under the
 * cube shows the active cardinal label derived from `currentAzimuth`.
 *
 * Animation: callers tween between the current and target alignments
 * over `--motion-slow` (240 ms) using `--ease-snap`. This component does
 * not own that tween — it just emits picks.
 */

export interface ViewCubeProps {
  currentAzimuth: number;
  onPick: (pick: ViewCubePick, alignment: ViewCubeAlignment) => void;
  onHome?: () => void;
  /** Optional className for positioning. */
  className?: string;
}

const FACES: ViewCubeFace[] = ['FRONT', 'BACK', 'LEFT', 'RIGHT', 'TOP', 'BOTTOM'];

const FACE_GRID: Record<ViewCubeFace, { gridColumn: number; gridRow: number }> = {
  TOP: { gridColumn: 2, gridRow: 1 },
  LEFT: { gridColumn: 1, gridRow: 2 },
  FRONT: { gridColumn: 2, gridRow: 2 },
  RIGHT: { gridColumn: 3, gridRow: 2 },
  BOTTOM: { gridColumn: 2, gridRow: 3 },
  BACK: { gridColumn: 4, gridRow: 2 },
};

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

  return (
    <div
      data-testid="view-cube"
      role="group"
      aria-label="ViewCube"
      onKeyDown={handleKey}
      className={['flex flex-col items-end gap-1.5', className ?? ''].join(' ')}
    >
      <div className="flex items-start gap-2">
        <FaceCross emit={emit} />
        <button
          type="button"
          onClick={() => {
            emit({ kind: 'home' });
            onHome?.();
          }}
          aria-label="Reset to default view"
          title="Click face to align camera; drag to orbit; double-click for default view."
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-foreground shadow-elev-2 hover:bg-surface-strong"
        >
          <Icons.viewCubeReset size={ICON_SIZE.chrome} aria-hidden="true" />
        </button>
      </div>
      <Compass currentAzimuth={currentAzimuth} />
      <CornerEdgeRow emit={emit} />
    </div>
  );
}

function FaceCross({ emit }: { emit: (pick: ViewCubePick) => void }): JSX.Element {
  const containerStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, var(--space-8))',
    gridTemplateRows: 'repeat(3, var(--space-8))',
    gap: '1px',
    background: 'var(--color-border)',
    padding: '1px',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--elev-2)',
  };
  return (
    <div style={containerStyle} aria-label="ViewCube faces">
      {FACES.map((face) => {
        const cell = FACE_GRID[face];
        return (
          <button
            key={face}
            type="button"
            onClick={() => emit({ kind: 'face', face })}
            aria-label={`Align camera to ${face}`}
            data-face={face}
            style={{
              gridColumn: cell.gridColumn,
              gridRow: cell.gridRow,
              background: 'var(--color-surface)',
              color: 'var(--color-foreground)',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: 'var(--text-eyebrow-tracking)',
              borderRadius: 2,
            }}
            className="hover:bg-surface-strong"
          >
            {face}
          </button>
        );
      })}
    </div>
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

function CornerEdgeRow({ emit }: { emit: (pick: ViewCubePick) => void }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <CornerButton emit={emit} corner="TOP-NE" label="NE-Iso" />
      <CornerButton emit={emit} corner="TOP-NW" label="NW-Iso" />
      <CornerButton emit={emit} corner="TOP-SE" label="SE-Iso" />
      <CornerButton emit={emit} corner="TOP-SW" label="SW-Iso" />
    </div>
  );
}

function CornerButton({
  emit,
  corner,
  label,
}: {
  emit: (pick: ViewCubePick) => void;
  corner: 'TOP-NE' | 'TOP-NW' | 'TOP-SE' | 'TOP-SW';
  label: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={() => emit({ kind: 'corner', corner })}
      aria-label={`Align camera to ${corner}`}
      className="rounded-sm border border-border bg-surface px-1.5 py-0.5 text-xs hover:bg-surface-strong"
    >
      {label}
    </button>
  );
}
