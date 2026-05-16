import { useCallback, useEffect, useRef, useState } from 'react';

import type { WalkthroughKeyframe } from '@bim-ai/core';

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

export function interpolateWalkthrough(
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

export type WalkthroughPlaybackPanelProps = {
  keyframes: WalkthroughKeyframe[];
  onFrame?: (frame: WalkthroughKeyframe) => void;
};

export function WalkthroughPlaybackPanel({ keyframes, onFrame }: WalkthroughPlaybackPanelProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedMultiplier>(1);
  const [loop, setLoop] = useState(false);

  const rafRef = useRef<number | null>(null);
  const currentSecRef = useRef<number>(0);

  const totalDuration =
    keyframes.length >= 2 ? keyframes[keyframes.length - 1]!.timeSec - keyframes[0]!.timeSec : 0;
  const startSec = keyframes[0]?.timeSec ?? 0;
  const endSec = keyframes[keyframes.length - 1]?.timeSec ?? 0;

  const advance = useCallback(() => {
    const FRAMES_PER_SEC = 30;
    currentSecRef.current += speed / FRAMES_PER_SEC;
    if (currentSecRef.current >= endSec) {
      if (loop) {
        currentSecRef.current = startSec;
      } else {
        currentSecRef.current = endSec;
        setPlaying(false);
      }
    }
    const frame = interpolateWalkthrough(keyframes, currentSecRef.current);
    if (frame) onFrame?.(frame);
  }, [speed, endSec, startSec, loop, keyframes, onFrame]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    const tick = () => {
      advance();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [playing, advance]);

  const handlePlayPause = useCallback(() => {
    if (!playing && currentSecRef.current >= endSec) {
      currentSecRef.current = startSec;
    }
    setPlaying((p) => !p);
  }, [playing, startSec, endSec]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    currentSecRef.current = startSec;
    const frame = interpolateWalkthrough(keyframes, startSec);
    if (frame) onFrame?.(frame);
  }, [startSec, keyframes, onFrame]);

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
          onChange={(e) => setSpeed(parseFloat(e.target.value) as SpeedMultiplier)}
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
          aria-label="Loop walkthrough"
          checked={loop}
          onChange={(e) => setLoop(e.target.checked)}
        />
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          type="button"
          aria-label={playing ? 'Pause walkthrough' : 'Play walkthrough'}
          disabled={keyframes.length < 2 || totalDuration === 0}
          onClick={handlePlayPause}
          style={{
            flex: 1,
            background: playing ? 'var(--color-accent)' : 'var(--color-surface-strong)',
            color: playing ? 'var(--color-accent-foreground)' : 'var(--color-foreground)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xs)',
            padding: 'var(--space-1) var(--space-2)',
            fontSize: 'var(--text-xs)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            pointerEvents: 'auto',
          }}
        >
          {playing ? '⏸ Pause' : '▶ Play'}
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
