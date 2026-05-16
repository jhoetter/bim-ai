import { useCallback, useEffect, useRef, useState } from 'react';

import { useSunStore } from '../sunStore';
import { computeSunPositionNoaa } from './sunPositionNoaa';

type StepMinutes = 15 | 30 | 60;
type SpeedMultiplier = 0.5 | 1 | 2 | 4;

const FRAMES_PER_STEP = 30;

function parseTimeInput(value: string): number | null {
  const m = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function SunAnimationPanel() {
  const values = useSunStore((s) => s.values);
  const setValues = useSunStore((s) => s.setValues);
  const setComputedPosition = useSunStore((s) => s.setComputedPosition);

  const [startInput, setStartInput] = useState('06:00');
  const [endInput, setEndInput] = useState('20:00');
  const [step, setStep] = useState<StepMinutes>(30);
  const [speed, setSpeed] = useState<SpeedMultiplier>(1);
  const [playing, setPlaying] = useState(false);

  const rafRef = useRef<number | null>(null);
  const currentSecRef = useRef<number>(6 * 3600);

  const startTimeSec = (parseTimeInput(startInput) ?? 360) * 60;
  const endTimeSec = (parseTimeInput(endInput) ?? 1200) * 60;
  const stepSec = step * 60;

  const advanceAndRender = useCallback(() => {
    const { values: v } = useSunStore.getState();
    currentSecRef.current += (stepSec * speed) / FRAMES_PER_STEP;
    if (currentSecRef.current >= endTimeSec) {
      currentSecRef.current = endTimeSec;
      const totalSec = endTimeSec;
      const h = Math.floor(totalSec / 3600) % 24;
      const m = Math.floor((totalSec % 3600) / 60);
      setValues({ hours: h, minutes: m });
      const { azimuthDeg, elevationDeg } = computeSunPositionNoaa(
        v.latitudeDeg,
        v.longitudeDeg,
        v.dateIso,
        h,
        m,
        v.daylightSavingStrategy,
      );
      setComputedPosition(azimuthDeg, elevationDeg);
      setPlaying(false);
      return;
    }
    const totalSec = currentSecRef.current;
    const h = Math.floor(totalSec / 3600) % 24;
    const m = Math.floor((totalSec % 3600) / 60);
    setValues({ hours: h, minutes: m });
    const { azimuthDeg, elevationDeg } = computeSunPositionNoaa(
      v.latitudeDeg,
      v.longitudeDeg,
      v.dateIso,
      h,
      m,
      v.daylightSavingStrategy,
    );
    setComputedPosition(azimuthDeg, elevationDeg);
  }, [stepSec, speed, endTimeSec, setValues, setComputedPosition]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    const loop = () => {
      advanceAndRender();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [playing, advanceAndRender]);

  const handlePlay = useCallback(() => {
    if (!playing) {
      if (currentSecRef.current >= endTimeSec) {
        currentSecRef.current = startTimeSec;
      }
    }
    setPlaying((p) => !p);
  }, [playing, startTimeSec, endTimeSec]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    currentSecRef.current = startTimeSec;
    const h = Math.floor(startTimeSec / 3600) % 24;
    const m = Math.floor((startTimeSec % 3600) / 60);
    setValues({ hours: h, minutes: m });
    const { values: v } = useSunStore.getState();
    const { azimuthDeg, elevationDeg } = computeSunPositionNoaa(
      v.latitudeDeg,
      v.longitudeDeg,
      v.dateIso,
      h,
      m,
      v.daylightSavingStrategy,
    );
    setComputedPosition(azimuthDeg, elevationDeg);
  }, [startTimeSec, setValues, setComputedPosition]);

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

  const labelStyle: React.CSSProperties = {
    flex: '0 0 auto',
    color: 'var(--color-muted-foreground)',
    width: 64,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--space-2)',
    alignItems: 'center',
  };

  return (
    <div
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
        Sun Study
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>Start</label>
        <input
          type="time"
          aria-label="Animation start time"
          value={startInput}
          onChange={(e) => setStartInput(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>End</label>
        <input
          type="time"
          aria-label="Animation end time"
          value={endInput}
          onChange={(e) => setEndInput(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>Step</label>
        <select
          aria-label="Animation step"
          value={step}
          onChange={(e) => setStep(parseInt(e.target.value, 10) as StepMinutes)}
          style={inputStyle}
        >
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={60}>1 hr</option>
        </select>
      </div>

      <div style={rowStyle}>
        <label style={labelStyle}>Speed</label>
        <select
          aria-label="Animation speed multiplier"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value) as SpeedMultiplier)}
          style={inputStyle}
        >
          <option value={0.5}>0.5×</option>
          <option value={1}>1×</option>
          <option value={2}>2×</option>
          <option value={4}>4×</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button
          type="button"
          aria-label={playing ? 'Pause sun study' : 'Play sun study'}
          onClick={handlePlay}
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
          aria-label="Reset sun study"
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

      {/* Show the sun's current time from values */}
      <div
        style={{
          fontSize: 'var(--text-2xs)',
          color: 'var(--color-muted-foreground)',
          textAlign: 'center',
        }}
      >
        {String(values.hours).padStart(2, '0')}:{String(values.minutes).padStart(2, '0')}
      </div>
    </div>
  );
}
