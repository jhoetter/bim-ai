import { useCallback, useEffect, useRef, useState } from 'react';

import type { CameraPathElem, WalkthroughKeyframe } from '@bim-ai/core';

type SpeedMultiplier = 0.5 | 1 | 2;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpKeyframe(
  a: WalkthroughKeyframe,
  b: WalkthroughKeyframe,
  t: number,
): WalkthroughKeyframe {
  return {
    positionMm: {
      x: lerp(a.positionMm.x, b.positionMm.x, t),
      y: lerp(a.positionMm.y, b.positionMm.y, t),
      z: lerp(a.positionMm.z, b.positionMm.z, t),
    },
    targetMm: {
      x: lerp(a.targetMm.x, b.targetMm.x, t),
      y: lerp(a.targetMm.y, b.targetMm.y, t),
      z: lerp(a.targetMm.z, b.targetMm.z, t),
    },
    fovDeg: lerp(a.fovDeg, b.fovDeg, t),
    timeSec: lerp(a.timeSec, b.timeSec, t),
  };
}

export function interpolateKeyframes(
  keyframes: WalkthroughKeyframe[],
  timeSec: number,
): WalkthroughKeyframe | null {
  if (keyframes.length === 0) return null;
  if (keyframes.length === 1) return keyframes[0]!;
  const first = keyframes[0]!;
  const last = keyframes[keyframes.length - 1]!;
  if (timeSec <= first.timeSec) return first;
  if (timeSec >= last.timeSec) return last;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const a = keyframes[i]!;
    const b = keyframes[i + 1]!;
    if (timeSec >= a.timeSec && timeSec <= b.timeSec) {
      const range = b.timeSec - a.timeSec;
      const t = range === 0 ? 0 : (timeSec - a.timeSec) / range;
      return lerpKeyframe(a, b, t);
    }
  }
  return last;
}

// Backward-compat alias used by existing tests
export const interpolateWalkthrough = interpolateKeyframes;

export type WalkthroughPlaybackPanelProps = {
  keyframes: WalkthroughKeyframe[];
  onFrame?: (frame: WalkthroughKeyframe) => void;
  selectedPath?: CameraPathElem;
};

export function WalkthroughPlaybackPanel({
  keyframes,
  onFrame,
  selectedPath,
}: WalkthroughPlaybackPanelProps) {
  const startSec = keyframes[0]?.timeSec ?? 0;
  const endSec = keyframes[keyframes.length - 1]?.timeSec ?? 0;
  const totalDuration = keyframes.length >= 2 ? endSec - startSec : 0;

  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedMultiplier>(1);
  const [loop, setLoop] = useState(false);
  const [currentSec, setCurrentSec] = useState(startSec);

  const rafRef = useRef<number | null>(null);
  const lastTickMsRef = useRef<number | null>(null);
  // Mutable ref tracks position without triggering effect restarts
  const currentSecRef = useRef<number>(startSec);
  const speedRef = useRef<SpeedMultiplier>(1);

  // Reset position when the path changes
  useEffect(() => {
    setIsPlaying(false);
    currentSecRef.current = startSec;
    setCurrentSec(startSec);
    lastTickMsRef.current = null;
  }, [keyframes, startSec]);

  useEffect(() => {
    if (!isPlaying || keyframes.length < 2) return;

    lastTickMsRef.current = null;

    const tick = (nowMs: number) => {
      // Delta-time advance using performance.now() timestamps supplied by RAF
      const delta = lastTickMsRef.current !== null ? (nowMs - lastTickMsRef.current) / 1000 : 0;
      lastTickMsRef.current = nowMs;

      let t = currentSecRef.current + delta * speedRef.current;

      if (t >= endSec) {
        if (loop) {
          t = startSec;
          lastTickMsRef.current = null;
        } else {
          t = endSec;
          currentSecRef.current = t;
          setCurrentSec(t);
          const frame = interpolateKeyframes(keyframes, t);
          if (frame) onFrame?.(frame);
          setIsPlaying(false);
          rafRef.current = null;
          return;
        }
      }

      currentSecRef.current = t;
      setCurrentSec(t);
      const frame = interpolateKeyframes(keyframes, t);
      if (frame) onFrame?.(frame);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isPlaying, loop, keyframes, onFrame, startSec, endSec]);

  const handlePlayPause = useCallback(() => {
    if (!isPlaying && currentSecRef.current >= endSec) {
      currentSecRef.current = startSec;
      setCurrentSec(startSec);
      lastTickMsRef.current = null;
    }
    setIsPlaying((p) => !p);
  }, [isPlaying, startSec, endSec]);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    currentSecRef.current = startSec;
    setCurrentSec(startSec);
    lastTickMsRef.current = null;
    const frame = interpolateKeyframes(keyframes, startSec);
    if (frame) onFrame?.(frame);
  }, [startSec, keyframes, onFrame]);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const t = parseFloat(e.target.value);
      currentSecRef.current = t;
      setCurrentSec(t);
      lastTickMsRef.current = null; // avoid delta overshoot on next tick
      const frame = interpolateKeyframes(keyframes, t);
      if (frame) onFrame?.(frame);
    },
    [keyframes, onFrame],
  );

  const handleExport = useCallback(() => {
    const data = selectedPath ?? {
      kind: 'camera_path' as const,
      id: 'exported',
      name: 'Walkthrough',
      keyframes,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [selectedPath, keyframes]);

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-background)',
    color: 'var(--color-foreground)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xs)',
    padding: 'var(--space-1)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'inherit',
    width: '100%',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--space-2)',
    alignItems: 'center',
  };

  return (
    <div
      data-testid="walkthrough-playback-panel"
      style={{
        borderTop: '1px solid var(--color-border)',
        marginTop: 'var(--space-2)',
        paddingTop: 'var(--space-2)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--text-2xs)',
          color: 'var(--color-muted-foreground)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        Walkthrough
      </div>

      <div style={rowStyle}>
        <label style={{ flex: '0 0 auto', color: 'var(--color-muted-foreground)', width: 64 }}>
          Speed
        </label>
        <select
          aria-label="Walkthrough playback speed"
          value={speed}
          onChange={(e) => {
            const s = parseFloat(e.target.value) as SpeedMultiplier;
            setSpeed(s);
            speedRef.current = s;
          }}
          style={inputStyle}
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
        </select>
      </div>

      <div style={rowStyle}>
        <label style={{ flex: '0 0 auto', color: 'var(--color-muted-foreground)', width: 64 }}>
          Loop
        </label>
        <input
          type="checkbox"
          data-testid="walkthrough-loop"
          aria-label="Loop walkthrough"
          checked={loop}
          onChange={(e) => setLoop(e.target.checked)}
        />
      </div>

      {keyframes.length >= 2 && totalDuration > 0 && (
        <input
          type="range"
          data-testid="walkthrough-scrubber"
          aria-label="Walkthrough scrubber"
          min={startSec}
          max={endSec}
          step={0.1}
          value={currentSec}
          onChange={handleScrub}
          style={{ width: '100%' }}
        />
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          type="button"
          data-testid="walkthrough-play-pause"
          aria-label={isPlaying ? 'Pause walkthrough' : 'Play walkthrough'}
          disabled={keyframes.length < 2 || totalDuration === 0}
          onClick={handlePlayPause}
          style={{
            flex: 1,
            background: isPlaying ? 'var(--color-accent)' : 'var(--color-surface-strong)',
            color: isPlaying ? 'var(--color-accent-foreground)' : 'var(--color-foreground)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xs)',
            padding: 'var(--space-1) var(--space-2)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            pointerEvents: 'auto',
          }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button
          type="button"
          aria-label="Reset walkthrough"
          onClick={handleReset}
          style={{
            background: 'var(--color-surface-strong)',
            color: 'var(--color-foreground)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xs)',
            padding: 'var(--space-1) var(--space-2)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            pointerEvents: 'auto',
          }}
        >
          ↺ Reset
        </button>
        <button
          type="button"
          data-testid="walkthrough-export-path"
          aria-label="Export walkthrough path"
          disabled={keyframes.length === 0}
          onClick={handleExport}
          style={{
            background: 'var(--color-surface-strong)',
            color: 'var(--color-foreground)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xs)',
            padding: 'var(--space-1) var(--space-2)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            pointerEvents: 'auto',
          }}
        >
          ↓ Export
        </button>
      </div>

      <div
        style={{
          fontSize: 'var(--text-2xs)',
          color: 'var(--color-muted-foreground)',
          textAlign: 'center',
        }}
      >
        {keyframes.length} keyframes · {Math.round(totalDuration)}s
      </div>
    </div>
  );
}
