// SunInspectorPanel — sun & shadow controls for the right-rail Scene section.
// Replaces the floating SunOverlay. No hex literals — all colours via CSS tokens.
import { type JSX, useCallback, useRef } from 'react';

import { useSunStore } from '../sunStore';

const SEASON_PRESETS = [
  { label: 'Winter', month: 12, day: 21 },
  { label: 'Equinox', month: 3, day: 20 },
  { label: 'Summer', month: 6, day: 21 },
] as const;

/** Map hour-of-day (5–19) to SVG x position (5–115). */
function hourToX(hour: number): number {
  const HOUR_MIN = 5;
  const HOUR_MAX = 19;
  const clamped = Math.min(Math.max(hour, HOUR_MIN), HOUR_MAX);
  return 5 + ((clamped - HOUR_MIN) / (HOUR_MAX - HOUR_MIN)) * 110;
}

/** Map SVG x position (5–115) back to fractional hour. */
function xToHour(x: number): number {
  const HOUR_MIN = 5;
  const HOUR_MAX = 19;
  const fraction = Math.min(Math.max((x - 5) / 110, 0), 1);
  return HOUR_MIN + fraction * (HOUR_MAX - HOUR_MIN);
}

/** Map elevation (0–90°) to SVG y position (55 = ground, 5 = zenith). */
function elevToY(elevDeg: number): number {
  const clamped = Math.min(Math.max(elevDeg, 0), 90);
  return 55 - (clamped / 90) * 50;
}

function formatStatusLine(
  dateIso: string,
  hours: number,
  minutes: number,
  azimuthDeg: number,
  elevationDeg: number,
): string {
  let dateLabel = dateIso;
  try {
    const d = new Date(dateIso + 'T12:00:00Z');
    dateLabel = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    // keep dateIso as fallback
  }
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${dateLabel}, ${hh}:${mm} — sun at ${Math.round(azimuthDeg)}°, ${Math.round(elevationDeg)}° elev.`;
}

function isoForPreset(month: number, day: number): string {
  const year = new Date().getFullYear();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function SunInspectorPanel(): JSX.Element {
  const values = useSunStore((s) => s.values);
  const azimuthDeg = useSunStore((s) => s.azimuthDeg);
  const elevationDeg = useSunStore((s) => s.elevationDeg);
  const setValues = useSunStore((s) => s.setValues);

  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const dotX = hourToX(values.hours + values.minutes / 60);
  const dotY = elevToY(elevationDeg);

  const handlePointerDown = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = true;
  }, []);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!draggingRef.current || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const rawX = ((e.clientX - rect.left) / rect.width) * 120;
      const fractionalHour = xToHour(rawX);
      const hours = Math.floor(fractionalHour);
      const minutes = Math.round((fractionalHour - hours) * 60);
      setValues({ hours, minutes });
    },
    [setValues],
  );

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const inputStyle: React.CSSProperties = {
    flex: 1,
    background: 'var(--color-background)',
    color: 'var(--color-foreground)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-xs)',
    padding: 'var(--space-1)',
    fontSize: 'var(--text-xs)',
    fontFamily: 'inherit',
  };

  const labelStyle: React.CSSProperties = {
    flex: '0 0 auto',
    color: 'var(--color-muted-foreground)',
    width: 64,
    fontSize: 'var(--text-xs)',
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: 'var(--space-2)',
    alignItems: 'center',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-foreground)',
      }}
    >
      {/* Status line */}
      <div
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--color-muted-foreground)',
          lineHeight: 1.4,
        }}
      >
        {formatStatusLine(values.dateIso, values.hours, values.minutes, azimuthDeg, elevationDeg)}
      </div>

      {/* SVG arc widget */}
      <svg
        ref={svgRef}
        width={120}
        height={60}
        viewBox="0 0 120 60"
        style={{ cursor: 'default', display: 'block', margin: '0 auto' }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        aria-label="Sun position arc — drag the dot to change time of day"
      >
        {/* Sky hemisphere arc */}
        <path
          d="M 5 55 A 55 55 0 0 1 115 55"
          stroke="var(--color-border)"
          fill="none"
          strokeWidth={1.5}
        />
        {/* Ground line */}
        <line
          x1={5}
          y1={55}
          x2={115}
          y2={55}
          stroke="var(--color-border-strong, var(--color-border))"
          strokeWidth={1}
        />
        {/* Sun dot */}
        <circle
          cx={dotX}
          cy={dotY}
          r={5}
          fill="var(--color-accent)"
          style={{ cursor: 'grab' }}
          onPointerDown={handlePointerDown}
          aria-label="Drag to change time of day"
        />
      </svg>

      {/* Season preset buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-1)', justifyContent: 'center' }}>
        {SEASON_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setValues({ dateIso: isoForPreset(preset.month, preset.day) })}
            style={{
              flex: 1,
              background: 'var(--color-surface-strong)',
              color: 'var(--color-foreground)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-xs)',
              padding: 'var(--space-1) var(--space-1)',
              fontSize: 'var(--text-2xs, var(--text-xs))',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Specific date input */}
      <div style={rowStyle}>
        <label style={labelStyle}>Date</label>
        <input
          type="date"
          value={values.dateIso}
          onChange={(e) => setValues({ dateIso: e.target.value })}
          style={inputStyle}
        />
      </div>

      {/* Advanced section — collapsed by default */}
      <details>
        <summary
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--color-muted-foreground)',
            cursor: 'pointer',
            userSelect: 'none',
            listStyle: 'none',
          }}
        >
          Advanced
        </summary>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            marginTop: 'var(--space-2)',
          }}
        >
          <div style={rowStyle}>
            <label style={labelStyle}>Latitude</label>
            <input
              type="number"
              min={-90}
              max={90}
              step={0.01}
              value={values.latitudeDeg}
              onChange={(e) => setValues({ latitudeDeg: parseFloat(e.target.value) || 0 })}
              style={inputStyle}
            />
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>Longitude</label>
            <input
              type="number"
              min={-180}
              max={180}
              step={0.01}
              value={values.longitudeDeg}
              onChange={(e) => setValues({ longitudeDeg: parseFloat(e.target.value) || 0 })}
              style={inputStyle}
            />
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>DST</label>
            <select
              value={values.daylightSavingStrategy}
              onChange={(e) =>
                setValues({ daylightSavingStrategy: e.target.value as 'auto' | 'on' | 'off' })
              }
              style={inputStyle}
            >
              <option value="auto">Auto</option>
              <option value="on">On</option>
              <option value="off">Off</option>
            </select>
          </div>
        </div>
      </details>
    </div>
  );
}
