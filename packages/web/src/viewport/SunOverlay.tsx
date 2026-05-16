import { useCallback, useState } from 'react';

import { SunAnimationPanel } from './SunAnimationPanel';

export interface SunOverlayValues {
  latitudeDeg: number;
  longitudeDeg: number;
  dateIso: string;
  hours: number;
  minutes: number;
  daylightSavingStrategy: 'auto' | 'on' | 'off';
}

interface SunOverlayProps {
  values: SunOverlayValues;
  azimuthDeg: number;
  elevationDeg: number;
  onChange: (patch: Partial<SunOverlayValues>) => void;
  onCommit: (patch: Partial<SunOverlayValues>) => void;
}

const LS_KEY = 'bim-ai-sun-overlay-collapsed';

function formatTime(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDate(dateIso: string): string {
  try {
    const d = new Date(dateIso + 'T12:00:00Z');
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateIso;
  }
}

export function SunOverlay({
  values,
  azimuthDeg,
  elevationDeg,
  onChange,
  onCommit,
}: SunOverlayProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(LS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(LS_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const timeMinutes = values.hours * 60 + values.minutes;

  const handleTimeSlider = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const total = parseInt(e.target.value, 10);
      onChange({ hours: Math.floor(total / 60), minutes: total % 60 });
    },
    [onChange],
  );

  const handleTimeCommit = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const total = parseInt(e.target.value, 10);
      onCommit({ hours: Math.floor(total / 60), minutes: total % 60 });
    },
    [onCommit],
  );

  const statusText = collapsed
    ? null
    : `${formatDate(values.dateIso)}, ${formatTime(values.hours, values.minutes)} — sun at ${Math.round(azimuthDeg)}°, ${Math.round(elevationDeg)}° elevation`;

  return (
    <div
      style={{
        position: 'absolute',
        top: 'var(--space-3)',
        right: 'var(--space-3)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 'var(--space-1)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        style={{
          pointerEvents: 'auto',
          background: 'var(--color-surface)',
          color: 'var(--color-foreground)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          padding: 'var(--space-1) var(--space-2)',
          fontSize: 'var(--text-xs)',
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
        aria-label="Toggle sun settings"
        aria-expanded={!collapsed}
      >
        ☀ Sun
      </button>

      {!collapsed && (
        <div
          style={{
            pointerEvents: 'auto',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: 'var(--space-3)',
            minWidth: 240,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-foreground)',
          }}
        >
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <label style={{ flex: '0 0 auto', color: 'var(--color-muted-foreground)', width: 64 }}>
              Latitude
            </label>
            <input
              type="number"
              aria-label="Latitude (degrees)"
              min={-90}
              max={90}
              step={0.01}
              value={values.latitudeDeg}
              onChange={(e) => onChange({ latitudeDeg: parseFloat(e.target.value) || 0 })}
              onBlur={(e) => onCommit({ latitudeDeg: parseFloat(e.target.value) || 0 })}
              style={{
                flex: 1,
                background: 'var(--color-background)',
                color: 'var(--color-foreground)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xs)',
                padding: 'var(--space-1)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <label style={{ flex: '0 0 auto', color: 'var(--color-muted-foreground)', width: 64 }}>
              Longitude
            </label>
            <input
              type="number"
              aria-label="Longitude (degrees)"
              min={-180}
              max={180}
              step={0.01}
              value={values.longitudeDeg}
              onChange={(e) => onChange({ longitudeDeg: parseFloat(e.target.value) || 0 })}
              onBlur={(e) => onCommit({ longitudeDeg: parseFloat(e.target.value) || 0 })}
              style={{
                flex: 1,
                background: 'var(--color-background)',
                color: 'var(--color-foreground)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xs)',
                padding: 'var(--space-1)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <label style={{ flex: '0 0 auto', color: 'var(--color-muted-foreground)', width: 64 }}>
              Date
            </label>
            <input
              type="date"
              aria-label="Sun date"
              value={values.dateIso}
              onChange={(e) => onChange({ dateIso: e.target.value })}
              onBlur={(e) => onCommit({ dateIso: e.target.value })}
              style={{
                flex: 1,
                background: 'var(--color-background)',
                color: 'var(--color-foreground)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-xs)',
                padding: 'var(--space-1)',
                fontSize: 'var(--text-xs)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--color-muted-foreground)',
              }}
            >
              <span>Time</span>
              <span>{formatTime(values.hours, values.minutes)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={1439}
              value={timeMinutes}
              onChange={handleTimeSlider}
              onMouseUp={handleTimeCommit as unknown as React.MouseEventHandler<HTMLInputElement>}
              onTouchEnd={handleTimeCommit as unknown as React.TouchEventHandler<HTMLInputElement>}
              style={{ width: '100%', accentColor: 'var(--color-accent)' }}
              aria-label="Time of day"
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: 'var(--color-muted-foreground)',
                fontSize: 'var(--text-2xs)',
              }}
            >
              <span>00:00</span>
              <span>12:00</span>
              <span>23:59</span>
            </div>
          </div>

          {statusText && (
            <div
              style={{
                marginTop: 'var(--space-1)',
                padding: 'var(--space-1) var(--space-2)',
                background: 'var(--color-surface-strong)',
                borderRadius: 'var(--radius-xs)',
                color: 'var(--color-muted-foreground)',
                fontSize: 'var(--text-2xs)',
                fontFamily: 'inherit',
              }}
            >
              {statusText}
            </div>
          )}

          <SunAnimationPanel />
        </div>
      )}
    </div>
  );
}
