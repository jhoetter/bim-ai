import type { JSX } from 'react';
import type { PlanTool } from '../state/store';
import type { ScaleState } from '../tools/toolGrammar';
import type { ToggleableSnapKind } from './snapSettings';

type MmPoint = { xMm: number; yMm: number };
type ScreenPoint = { pxX: number; pxY: number };
type NumericInputState = { value: string; pxX: number; pxY: number };
type WorldToScreen = (xy: MmPoint) => ScreenPoint;

const CHIP_STYLE = {
  position: 'absolute',
  bottom: 48,
  left: '50%',
  transform: 'translateX(-50%)',
  pointerEvents: 'none',
  zIndex: 20,
} as const;

const FULL_OVERLAY_STYLE = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  zIndex: 15,
  overflow: 'visible',
} as const;

const ACCENT = 'hsl(var(--color-accent, 220 90% 56%))';

function StatusChip({
  testId,
  children,
}: {
  testId: string;
  children: JSX.Element | string;
}): JSX.Element {
  return (
    <div
      style={CHIP_STYLE}
      className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs shadow"
      data-testid={testId}
      aria-live="polite"
    >
      <span>{children}</span>
    </div>
  );
}

function SnapOverrideChip({
  snapOverrideDisplay,
  onCancel,
}: {
  snapOverrideDisplay: ToggleableSnapKind | null;
  onCancel: () => void;
}): JSX.Element | null {
  if (!snapOverrideDisplay) return null;
  const shortCode: Partial<Record<ToggleableSnapKind, string>> = {
    intersection: 'SI',
    endpoint: 'SE',
    midpoint: 'SM',
    nearest: 'SN',
    center: 'SC',
    perpendicular: 'SP',
    extension: 'SX',
    workplane: 'SW',
    parallel: 'SA',
    tangent: 'ST',
    grid: 'SG',
  };
  const code = shortCode[snapOverrideDisplay];
  const label =
    snapOverrideDisplay === 'workplane'
      ? 'Work Plane'
      : snapOverrideDisplay.charAt(0).toUpperCase() + snapOverrideDisplay.slice(1);
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 72,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 20,
      }}
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-400/60 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 shadow"
      data-testid="snap-override-chip"
    >
      <span>{`Snap: ${label}${code ? ` [${code}]` : ''} (next pick only)`}</span>
      <button
        type="button"
        className="ml-1 text-amber-400 hover:text-amber-200"
        aria-label="Cancel snap override"
        onClick={onCancel}
      >
        ×
      </button>
    </div>
  );
}

function MoveToolOverlay({
  anchorMm,
  cursorMm,
  worldToScreen,
}: {
  anchorMm: MmPoint;
  cursorMm?: MmPoint;
  worldToScreen: WorldToScreen;
}): JSX.Element {
  const anchorPx = worldToScreen(anchorMm);
  const cursorPx = cursorMm ? worldToScreen(cursorMm) : null;
  return (
    <>
      <svg data-testid="move-tool-overlay" aria-hidden="true" style={FULL_OVERLAY_STYLE}>
        <circle cx={anchorPx.pxX} cy={anchorPx.pxY} r="5" fill={ACCENT} opacity="0.9" />
        {cursorPx ? (
          <line
            x1={anchorPx.pxX}
            y1={anchorPx.pxY}
            x2={cursorPx.pxX}
            y2={cursorPx.pxY}
            stroke={ACCENT}
            strokeWidth="1.5"
            strokeDasharray="6 3"
            opacity="0.7"
          />
        ) : null}
      </svg>
      <StatusChip testId="move-tool-chip">Click destination point to move selection</StatusChip>
    </>
  );
}

function RotateToolOverlay({
  anchorMm,
  referenceMm,
  cursorMm,
  rotateReferenceSet,
  worldToScreen,
}: {
  anchorMm: MmPoint;
  referenceMm?: MmPoint | null;
  cursorMm?: MmPoint;
  rotateReferenceSet: boolean;
  worldToScreen: WorldToScreen;
}): JSX.Element {
  const anchorPx = worldToScreen(anchorMm);
  const referencePx = referenceMm ? worldToScreen(referenceMm) : null;
  const cursorPx = cursorMm ? worldToScreen(cursorMm) : null;
  return (
    <>
      <svg data-testid="rotate-tool-overlay" aria-hidden="true" style={FULL_OVERLAY_STYLE}>
        <circle
          cx={anchorPx.pxX}
          cy={anchorPx.pxY}
          r="12"
          fill="none"
          stroke={ACCENT}
          strokeWidth="1.5"
          opacity="0.8"
        />
        <circle cx={anchorPx.pxX} cy={anchorPx.pxY} r="3" fill={ACCENT} opacity="0.9" />
        {referencePx ? (
          <line
            x1={anchorPx.pxX}
            y1={anchorPx.pxY}
            x2={referencePx.pxX}
            y2={referencePx.pxY}
            stroke={ACCENT}
            strokeWidth="2"
            opacity="0.85"
          />
        ) : null}
        {cursorPx ? (
          <line
            x1={anchorPx.pxX}
            y1={anchorPx.pxY}
            x2={cursorPx.pxX}
            y2={cursorPx.pxY}
            stroke={ACCENT}
            strokeWidth="1"
            strokeDasharray="5 3"
            opacity="0.7"
          />
        ) : null}
      </svg>
      <StatusChip testId="rotate-tool-chip">
        {rotateReferenceSet ? 'Click end ray or type angle + Enter' : 'Click start reference ray'}
      </StatusChip>
    </>
  );
}

function AlignReferenceOverlay({
  referenceMm,
  worldToScreen,
}: {
  referenceMm: MmPoint;
  worldToScreen: WorldToScreen;
}): JSX.Element {
  const refPx = worldToScreen(referenceMm);
  return (
    <>
      <svg data-testid="align-reference-overlay" aria-hidden="true" style={FULL_OVERLAY_STYLE}>
        <line
          x1="0"
          y1={refPx.pxY}
          x2="100%"
          y2={refPx.pxY}
          stroke={ACCENT}
          strokeWidth="1.5"
          strokeDasharray="6 4"
          opacity="0.75"
        />
        <line
          x1={refPx.pxX}
          y1="0"
          x2={refPx.pxX}
          y2="100%"
          stroke={ACCENT}
          strokeWidth="1.5"
          strokeDasharray="6 4"
          opacity="0.75"
        />
        <circle cx={refPx.pxX} cy={refPx.pxY} r="4" fill={ACCENT} opacity="0.9" />
        <text
          x={refPx.pxX + 8}
          y={refPx.pxY - 6}
          fontSize="10"
          fontFamily="var(--font-mono, monospace)"
          fill={ACCENT}
          opacity="0.85"
        >
          {`X ${(referenceMm.xMm / 1000).toFixed(2)} m · Y ${(referenceMm.yMm / 1000).toFixed(2)} m`}
        </text>
      </svg>
      <StatusChip testId="align-tool-chip">
        Click near a wall to align it to the reference line
      </StatusChip>
    </>
  );
}

function MirrorAxisOverlay({
  axisStartMm,
  cursorMm,
  worldToScreen,
}: {
  axisStartMm: MmPoint;
  cursorMm?: MmPoint;
  worldToScreen: WorldToScreen;
}): JSX.Element {
  const axisStartPx = worldToScreen(axisStartMm);
  const cursorPx = cursorMm ? worldToScreen(cursorMm) : null;
  return (
    <>
      <svg data-testid="mirror-axis-overlay" aria-hidden="true" style={FULL_OVERLAY_STYLE}>
        <circle cx={axisStartPx.pxX} cy={axisStartPx.pxY} r="5" fill={ACCENT} opacity="0.9" />
        {cursorPx ? (
          <line
            x1={axisStartPx.pxX}
            y1={axisStartPx.pxY}
            x2={cursorPx.pxX}
            y2={cursorPx.pxY}
            stroke={ACCENT}
            strokeWidth="1.5"
            strokeDasharray="8 4"
            opacity="0.75"
          />
        ) : null}
      </svg>
      <StatusChip testId="mirror-axis-chip">Click second point to define mirror axis</StatusChip>
    </>
  );
}

function NumericInputOverlay({
  numericInput,
  planTool,
  rotateNumericActive,
  scalePhase,
}: {
  numericInput: NumericInputState;
  planTool: PlanTool;
  rotateNumericActive: boolean;
  scalePhase: ScaleState['phase'];
}): JSX.Element {
  return (
    <div
      data-testid="grip-numeric-input"
      style={{
        position: 'absolute',
        left: numericInput.pxX + 12,
        top: numericInput.pxY + 12,
        zIndex: 20,
        pointerEvents: 'none',
        background: 'rgba(20,28,42,0.92)',
        border: '1px solid var(--color-accent)',
        borderRadius: 3,
        color: 'var(--color-accent)',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
        fontSize: 'var(--text-2xs, 10px)',
        lineHeight: 'var(--text-2xs-line, 14px)',
        fontFeatureSettings: '"tnum"',
        padding: '2px 6px',
        minWidth: 60,
      }}
    >
      {numericInput.value || '0'}
      <span style={{ opacity: 0.6 }}>
        {rotateNumericActive
          ? ' deg'
          : planTool === 'scale' && scalePhase === 'enter-factor'
            ? '×'
            : ' mm'}{' '}
        · Enter
      </span>
    </div>
  );
}

function ScaleInstructionBanner({ scalePhase }: { scalePhase: ScaleState['phase'] }): JSX.Element {
  return (
    <div
      data-testid="scale-instruction"
      aria-live="polite"
      style={{
        position: 'absolute',
        bottom: 40,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 20,
        background: 'rgba(20,28,42,0.88)',
        border: '1px solid var(--color-accent)',
        borderRadius: 4,
        color: 'var(--color-accent)',
        fontSize: 'var(--text-xs, 11px)',
        padding: '4px 12px',
        whiteSpace: 'nowrap',
      }}
    >
      {scalePhase === 'pick-origin'
        ? 'Click scale origin'
        : scalePhase === 'enter-factor'
          ? 'Type factor + Enter  or  click reference point'
          : scalePhase === 'pick-reference'
            ? 'Click reference distance'
            : 'Click new distance'}
    </div>
  );
}

export function PlanCanvasToolOverlays({
  planTool,
  snapOverrideDisplay,
  onCancelSnapOverride,
  copyAnchorSet,
  moveAnchorSet,
  moveAnchorMm,
  rotateAnchorSet,
  rotateAnchorMm,
  rotateReferenceSet,
  rotateReferenceMm,
  alignReferenceMm,
  mirrorAxisSet,
  mirrorAxisStartMm,
  trimExtendFirstWallSet,
  hudMm,
  numericInput,
  hasGripDrag,
  scalePhase,
  worldToScreen,
}: {
  planTool: PlanTool;
  snapOverrideDisplay: ToggleableSnapKind | null;
  onCancelSnapOverride: () => void;
  copyAnchorSet: boolean;
  moveAnchorSet: boolean;
  moveAnchorMm?: MmPoint | null;
  rotateAnchorSet: boolean;
  rotateAnchorMm?: MmPoint | null;
  rotateReferenceSet: boolean;
  rotateReferenceMm?: MmPoint | null;
  alignReferenceMm?: MmPoint | null;
  mirrorAxisSet: boolean;
  mirrorAxisStartMm?: MmPoint | null;
  trimExtendFirstWallSet: boolean;
  hudMm?: MmPoint | null;
  numericInput: NumericInputState | null;
  hasGripDrag: boolean;
  scalePhase: ScaleState['phase'];
  worldToScreen: WorldToScreen;
}): JSX.Element {
  const rotateNumericActive = planTool === 'rotate' && rotateAnchorSet && rotateReferenceSet;
  const showNumeric =
    Boolean(numericInput) &&
    (hasGripDrag || rotateNumericActive || (planTool === 'scale' && scalePhase === 'enter-factor'));

  return (
    <>
      <SnapOverrideChip snapOverrideDisplay={snapOverrideDisplay} onCancel={onCancelSnapOverride} />
      {planTool === 'copy' ? (
        <StatusChip testId="copy-tool-chip">
          {copyAnchorSet
            ? 'Click destination point to complete copy'
            : 'Click reference point · hold Shift to constrain'}
        </StatusChip>
      ) : null}
      {planTool === 'room' ? (
        <StatusChip testId="room-tool-chip">
          Click inside an enclosed area to place a room
        </StatusChip>
      ) : null}
      {planTool === 'floor' ? (
        <StatusChip testId="floor-tool-chip">
          Shift+click to auto-detect boundary from walls
        </StatusChip>
      ) : null}
      {planTool === 'move' && moveAnchorSet && moveAnchorMm ? (
        <MoveToolOverlay
          anchorMm={moveAnchorMm}
          cursorMm={hudMm ?? undefined}
          worldToScreen={worldToScreen}
        />
      ) : null}
      {planTool === 'move' && !moveAnchorSet ? (
        <StatusChip testId="move-tool-chip">Click reference point</StatusChip>
      ) : null}
      {planTool === 'offset' ? (
        <StatusChip testId="offset-tool-chip">
          Click the target side/distance for the selected wall
        </StatusChip>
      ) : null}
      {planTool === 'rotate' && rotateAnchorSet && rotateAnchorMm ? (
        <RotateToolOverlay
          anchorMm={rotateAnchorMm}
          referenceMm={rotateReferenceMm}
          cursorMm={hudMm ?? undefined}
          rotateReferenceSet={rotateReferenceSet}
          worldToScreen={worldToScreen}
        />
      ) : null}
      {planTool === 'align' && alignReferenceMm ? (
        <AlignReferenceOverlay referenceMm={alignReferenceMm} worldToScreen={worldToScreen} />
      ) : null}
      {planTool === 'mirror' && mirrorAxisSet && mirrorAxisStartMm ? (
        <MirrorAxisOverlay
          axisStartMm={mirrorAxisStartMm}
          cursorMm={hudMm ?? undefined}
          worldToScreen={worldToScreen}
        />
      ) : null}
      {planTool === 'trim-extend' ? (
        <StatusChip testId="trim-extend-tool-chip">
          {trimExtendFirstWallSet
            ? 'Click second wall to extend to corner'
            : 'Click a wall to trim/extend'}
        </StatusChip>
      ) : null}
      {showNumeric && numericInput ? (
        <NumericInputOverlay
          numericInput={numericInput}
          planTool={planTool}
          rotateNumericActive={rotateNumericActive}
          scalePhase={scalePhase}
        />
      ) : null}
      {planTool === 'scale' && scalePhase !== 'idle' ? (
        <ScaleInstructionBanner scalePhase={scalePhase} />
      ) : null}
    </>
  );
}
