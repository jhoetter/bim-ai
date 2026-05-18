import React, { type JSX } from 'react';

import { useBimStore } from '../state/store';
import type { AppSettings } from '../state/storeTypes';

interface AppSettingsPanelProps {
  onClose: () => void;
}

const DEFAULT_APP_SETTINGS: AppSettings = { defaultUnits: 'mm', uiDensity: 'normal' };

export function AppSettingsPanel({ onClose }: AppSettingsPanelProps): JSX.Element {
  const appSettings = useBimStore((s) => s.appSettings ?? DEFAULT_APP_SETTINGS);

  const updateSettings = (patch: Partial<AppSettings>): void => {
    useBimStore.setState((s) => ({
      appSettings: { ...(s.appSettings ?? DEFAULT_APP_SETTINGS), ...patch },
    }));
  };

  return (
    <div
      data-testid="app-settings-panel"
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 380,
        background: 'var(--panel-bg, #1e1e2e)',
        border: '1px solid var(--border, #444)',
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 10000,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>Settings</span>
        <button
          data-testid="app-settings-close"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: 'inherit',
          }}
        >
          x
        </button>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Default Length Units</span>
          <select
            data-testid="app-settings-units"
            value={appSettings.defaultUnits}
            onChange={(e) =>
              updateSettings({ defaultUnits: e.currentTarget.value as AppSettings['defaultUnits'] })
            }
            style={{
              fontSize: 12,
              padding: '4px 6px',
              borderRadius: 4,
              border: '1px solid var(--border)',
            }}
          >
            <option value="mm">Millimeters (mm)</option>
            <option value="cm">Centimeters (cm)</option>
            <option value="m">Meters (m)</option>
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>UI Density</span>
          <select
            data-testid="app-settings-density"
            value={appSettings.uiDensity}
            onChange={(e) =>
              updateSettings({ uiDensity: e.currentTarget.value as AppSettings['uiDensity'] })
            }
            style={{
              fontSize: 12,
              padding: '4px 6px',
              borderRadius: 4,
              border: '1px solid var(--border)',
            }}
          >
            <option value="normal">Normal</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Keyboard Shortcuts</span>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--muted, #888)' }}>
            Open the command palette and keyboard reference from the workspace shortcuts command.
          </p>
        </div>
      </div>
    </div>
  );
}
