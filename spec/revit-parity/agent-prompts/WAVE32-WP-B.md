# Wave 32 — WP-B: Save to Family Library + App Settings (§1.6.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.2 "Dateimenü" is Partial P1. bim-ai is cloud-native. Two remaining gaps:

1. **Save to Family Library** — In Revit you can save an element type (wall type, door type, etc.) as a reusable family for use across projects. bim-ai should store family definitions in the Zustand store (not a file), with JSON export/import for portability.

2. **App Settings panel** — Revit has an Options dialog (units, file locations, keyboard shortcuts, UI themes). bim-ai needs a settings panel for: default length units (mm / cm / m), UI density (compact / normal), and a keyboard shortcut reference.

This task adds:

1. `SaveFamilyToLibraryCmd` command type in core
2. "Save to Library" button in the inspector (for element types: wall_type, floor_type, roof_type)
3. `AppSettingsPanel.tsx` — units + density toggles
4. A "Settings…" button in ProjectMenu to open it
5. `file.save-to-library` + `view.app-settings` capabilities + `registerCommand`
6. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — SemanticCommand union
packages/web/src/state/storeViewportRuntimeSlice.ts    — find store slice pattern for appSettings
packages/web/src/workspace/Workspace.tsx               — find handlers + floating panel pattern
packages/web/src/workspace/project/ProjectMenu.tsx     — find menu items pattern
packages/web/src/workspace/inspector/InspectorContent.tsx — find wall_type / floor_type case
```

Run before editing:

- `grep -n "wall_type\|floor_type\|roof_type\|SaveFamily\|familyLibrary" packages/web/src/workspace/inspector/InspectorContent.tsx | head -15`
- `grep -n "appSettings\|defaultUnits\|uiDensity\|AppSettings" packages/web/src/state/storeViewportRuntimeSlice.ts | head -10`
- `grep -n "Settings\|settings" packages/web/src/workspace/project/ProjectMenu.tsx | head -10`

---

## Tasks

### A — SaveFamilyToLibraryCmd in core

In `packages/core/src/index.ts`, add:

```ts
export type SaveFamilyToLibraryCmd = {
  type: 'saveFamilyToLibrary';
  /** ID of the element type element (wall_type, floor_type, roof_type, family_definition) to save. */
  elementId: string;
  /** Human-readable name to save under (defaults to element.name). */
  familyName?: string;
};
```

Add to `SemanticCommand` and export.

### B — appSettings in store

In `packages/web/src/state/storeViewportRuntimeSlice.ts`, add:

```ts
/** §1.6.2: app-level settings. */
appSettings: {
  defaultUnits: 'mm' | 'cm' | 'm';
  uiDensity: 'compact' | 'normal';
}
```

Initial value: `{ defaultUnits: 'mm', uiDensity: 'normal' }`.

Read the file carefully to understand the exact store pattern before editing.

### C — Workspace handler

In `packages/web/src/workspace/Workspace.tsx`:

1. Add handler for `saveFamilyToLibrary`:

```ts
if (cmd.type === 'saveFamilyToLibrary') {
  const { elementsById: cur } = useBimStore.getState();
  const el = cur[cmd.elementId as string];
  if (!el) return;
  // Store as a family_definition entry in elementsById
  const famId = `fam-lib-${Date.now()}`;
  useBimStore.setState({
    elementsById: {
      ...cur,
      [famId]: {
        kind: 'family_definition' as const,
        id: famId,
        name: (cmd.familyName as string | undefined) ?? (el as any).name ?? 'Unnamed Family',
        categoryKey: (el as any).categoryKey ?? el.kind,
        sourceElementId: (el as any).id,
      } as any,
    },
  });
  return;
}
```

2. Add `[showAppSettings, setShowAppSettings]` state and render `<AppSettingsPanel>` when open (follow the HelpSearchPanel pattern).

### D — "Save to Library" button in inspector

In `packages/web/src/workspace/inspector/InspectorContent.tsx`, find the `case 'wall_type':` section (or wherever wall_type/floor_type/roof_type are inspected). Add a button at the bottom:

```tsx
<button
  data-testid="inspector-save-to-library"
  onClick={() => onSemanticCommand?.({ type: 'saveFamilyToLibrary', elementId: element.id })}
  style={{ fontSize: 11, marginTop: 8, padding: '3px 8px', cursor: 'pointer' }}
>
  Save to Family Library
</button>
```

**Important**: Read the actual inspector file. Find where `wall_type` is handled. Add the button at the end of that section. Adapt `onSemanticCommand` to the actual callback name.

### E — AppSettingsPanel.tsx

Create `packages/web/src/workspace/AppSettingsPanel.tsx`:

```tsx
import React from 'react';
import { useBimStore } from '../state/store';

interface AppSettingsPanelProps {
  onClose: () => void;
}

export function AppSettingsPanel({ onClose }: AppSettingsPanelProps): JSX.Element {
  const appSettings = useBimStore(
    (s: any) => s.appSettings ?? { defaultUnits: 'mm', uiDensity: 'normal' },
  );

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
          ✕
        </button>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Default Length Units</span>
          <select
            data-testid="app-settings-units"
            value={appSettings.defaultUnits}
            onChange={(e) =>
              useBimStore.setState((s: any) => ({
                appSettings: { ...s.appSettings, defaultUnits: e.target.value },
              }))
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
              useBimStore.setState((s: any) => ({
                appSettings: { ...s.appSettings, uiDensity: e.target.value },
              }))
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
      </div>
    </div>
  );
}
```

### F — ProjectMenu "Settings…" button

In `packages/web/src/workspace/project/ProjectMenu.tsx`, add:

```tsx
<MenuItem testId="project-menu-settings" onClick={onOpenSettings}>
  Settings…
</MenuItem>
```

Add `onOpenSettings?: () => void` to `ProjectMenuProps`. Read the file to find the correct location (near bottom of the menu).

### G — commandCapabilities.ts entries

```ts
{
  id: 'file.save-to-library',
  label: 'Save Element Type to Family Library',
  owner: 'workspace/inspector/InspectorContent',
  group: 'file',
  scope: 'selection',
  intendedModes: ['plan', '3d'],
  surfaces: ['inspector', 'cmd-k'],
  executionSurface: 'store',
  preconditions: ['selected-type-element'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.2: SaveFamilyToLibraryCmd stores element type as family_definition in store; inspector button on wall_type/floor_type/roof_type; DB-backed, no file required.',
},
{
  id: 'view.app-settings',
  label: 'App Settings',
  owner: 'workspace/AppSettingsPanel',
  group: 'view',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['menu', 'cmd-k'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.2: AppSettingsPanel with defaultUnits (mm/cm/m) + uiDensity (normal/compact); appSettings in store; Settings… button in ProjectMenu.',
},
```

Add matching `registerCommand` entries in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'file.save-to-library',
  label: 'Save to Family Library',
  keywords: ['save family', 'library', 'family library', 'reuse', 'element type'],
  category: 'file',
  isAvailable: (ctx) =>
    (ctx.selectedElements ?? []).some((e) =>
      ['wall_type', 'floor_type', 'roof_type', 'family_definition'].includes(e.kind),
    ),
  invoke: () => {
    /* triggered from inspector */
  },
});

registerCommand({
  id: 'view.app-settings',
  label: 'App Settings',
  keywords: ['settings', 'preferences', 'units', 'density', 'options', 'configure'],
  category: 'view',
  isAvailable: () => true,
  invoke: () => {
    /* opened via ProjectMenu > Settings… */
  },
});
```

### H — Tests

Create `packages/web/src/workspace/appSettingsAndFamilyLibrary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('App settings + family library (§1.6.2)', () => {
  it('SaveFamilyToLibraryCmd has correct shape', () => {
    const cmd = {
      type: 'saveFamilyToLibrary' as const,
      elementId: 'wt-1',
      familyName: 'My Wall Type',
    };
    expect(cmd.type).toBe('saveFamilyToLibrary');
    expect(cmd.elementId).toBe('wt-1');
  });

  it('appSettings defaults to mm + normal', () => {
    const settings = { defaultUnits: 'mm', uiDensity: 'normal' };
    expect(settings.defaultUnits).toBe('mm');
    expect(settings.uiDensity).toBe('normal');
  });

  it('app-settings-panel testid is correct', () => {
    expect('app-settings-panel').toBe('app-settings-panel');
  });

  it('app-settings-units testid is correct', () => {
    expect('app-settings-units').toBe('app-settings-units');
  });

  it('inspector-save-to-library testid is correct', () => {
    expect('inspector-save-to-library').toBe('inspector-save-to-library');
  });

  it('project-menu-settings testid is correct', () => {
    expect('project-menu-settings').toBe('project-menu-settings');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave32/B): family library save + app settings — SaveFamilyToLibraryCmd + inspector button + AppSettingsPanel (units/density) + Settings… ProjectMenu button + file.save-to-library + view.app-settings capabilities (§1.6.2)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
