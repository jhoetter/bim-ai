# Wave 24 — WP-E: Window/Door Type Presets Expansion (§3.6.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§3.6.2 "Fenster aus Bibliotheken" is Partial. The family library panel exists with window and door entries, but the selection of available types is narrow compared to Revit's full library. This task adds **window and door type presets** to expand the catalog:

Window types to add: Single Casement, Double Hung, Awning, Fixed Glazing, Sliding (2-panel)
Door types to add: Sliding Door, Double-leaf Door, Pocket Door

These are stored as `window_type_preset` / `door_type_preset` records (or whatever the actual catalog type system uses) — the goal is to expose more types in the ToolPalette/FamilyLibraryPanel so architects can pick diverse window/door variants.

---

## Repo orientation

```
packages/web/src/families/FamilyLibraryPanel.tsx       — find how families are stored; look for any presets array
packages/web/src/tools/ToolPalette.tsx                 — find how window/door types are listed
packages/web/src/cmdPalette/defaultCommands.ts         — find 'tool.window' or 'tool.door' commands
packages/web/src/workspace/Workspace.tsx               — find placeWindow/placeWindowFamily handlers
packages/web/src/schedules/scheduleDefinitionPresets.ts — separate file; find preset pattern to copy
```

Run before editing:

- `grep -n "window.*preset\|windowPreset\|WINDOW_TYPES\|windowType\|WindowType" packages/web/src/ -r | grep -v "test\|node_modules" | head -20`
- `grep -n "door.*preset\|doorPreset\|DOOR_TYPES\|doorType\|DoorType" packages/web/src/ -r | grep -v "test\|node_modules" | head -20`
- `grep -n "'window'\|'door'" packages/web/src/tools/ToolPalette.tsx | head -10`
- `grep -n "windowOpeningTypeId\|doorOpeningTypeId\|openingType\|windowKind" packages/core/src/index.ts | head -10`

Read the actual window and door element types in `packages/core/src/index.ts` to understand what fields control their visual appearance (widthMm, heightMm, sillHeightMm, and any `kind`/`style` field).

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Survey the current window/door type system

Run:

```
grep -n "kind: 'window'" packages/core/src/index.ts | head -5
```

Read the `window` union member to understand fields available for style differentiation (look for `windowStyle`, `operationType`, `glazingType`, or similar optional fields).

If no style/operation field exists on the window element, add:

```ts
/** §3.6.2: visual/operation style of the window. */
windowStyle?: 'casement' | 'double_hung' | 'awning' | 'fixed' | 'sliding' | null;
```

Similarly for door:

```ts
/** §3.6.2: operation style of the door. */
doorStyle?: 'single' | 'sliding' | 'double_leaf' | 'pocket' | null;
```

### B — Create window/door preset definitions file

Create `packages/web/src/tools/windowDoorPresets.ts`:

```ts
/** §3.6.2: standard window type presets for the family library panel. */
export interface WindowPreset {
  id: string;
  label: string;
  labelDe: string;
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;
  windowStyle: 'casement' | 'double_hung' | 'awning' | 'fixed' | 'sliding';
}

export const WINDOW_PRESETS: WindowPreset[] = [
  {
    id: 'wp-casement-900x1200',
    label: 'Single Casement 900×1200',
    labelDe: 'Einfachflügel 900×1200',
    widthMm: 900,
    heightMm: 1200,
    sillHeightMm: 900,
    windowStyle: 'casement',
  },
  {
    id: 'wp-double-hung-900x1500',
    label: 'Double Hung 900×1500',
    labelDe: 'Doppelt-Hänge 900×1500',
    widthMm: 900,
    heightMm: 1500,
    sillHeightMm: 800,
    windowStyle: 'double_hung',
  },
  {
    id: 'wp-awning-1200x600',
    label: 'Awning 1200×600',
    labelDe: 'Kippfenster 1200×600',
    widthMm: 1200,
    heightMm: 600,
    sillHeightMm: 1400,
    windowStyle: 'awning',
  },
  {
    id: 'wp-fixed-1800x2100',
    label: 'Fixed Glazing 1800×2100',
    labelDe: 'Festverglasung 1800×2100',
    widthMm: 1800,
    heightMm: 2100,
    sillHeightMm: 0,
    windowStyle: 'fixed',
  },
  {
    id: 'wp-sliding-1600x2100',
    label: 'Sliding 2-Panel 1600×2100',
    labelDe: 'Schiebefenster 1600×2100',
    widthMm: 1600,
    heightMm: 2100,
    sillHeightMm: 0,
    windowStyle: 'sliding',
  },
];

/** §3.6.2: standard door type presets for the family library panel. */
export interface DoorPreset {
  id: string;
  label: string;
  labelDe: string;
  widthMm: number;
  heightMm: number;
  doorStyle: 'single' | 'sliding' | 'double_leaf' | 'pocket';
}

export const DOOR_PRESETS: DoorPreset[] = [
  {
    id: 'dp-single-900x2100',
    label: 'Single Door 900×2100',
    labelDe: 'Einfachtür 900×2100',
    widthMm: 900,
    heightMm: 2100,
    doorStyle: 'single',
  },
  {
    id: 'dp-sliding-1800x2100',
    label: 'Sliding Door 1800×2100',
    labelDe: 'Schiebetür 1800×2100',
    widthMm: 1800,
    heightMm: 2100,
    doorStyle: 'sliding',
  },
  {
    id: 'dp-double-leaf-1500x2100',
    label: 'Double-leaf Door 1500×2100',
    labelDe: 'Zweiflügeltür 1500×2100',
    widthMm: 1500,
    heightMm: 2100,
    doorStyle: 'double_leaf',
  },
  {
    id: 'dp-pocket-900x2100',
    label: 'Pocket Door 900×2100',
    labelDe: 'Schiebetür (versenkbar) 900×2100',
    widthMm: 900,
    heightMm: 2100,
    doorStyle: 'pocket',
  },
];
```

### C — Add presets to FamilyLibraryPanel or ToolPalette

Read `FamilyLibraryPanel.tsx` to understand how window/door catalog entries are displayed. Find the relevant section and integrate the presets. The approach depends on the actual implementation — adapt accordingly:

- If the panel has a static list of families, append the new preset entries
- If there's a catalog data file, add entries there
- If families are loaded from `familyTemplateCatalog.ts`, add entries there

The minimum requirement: a user can see "Single Casement 900×1200", "Sliding Door 1800×2100" etc. in the panel and clicking one creates a `placeWindow`/`placeDoor` command with the preset's dimensions and style.

### D — PlaceWindowPreset / PlaceDoorPreset commands

If the current `placeWindow` command already accepts widthMm/heightMm/sillHeightMm, you can wire presets to dispatch those commands directly. If not, add palette commands:

In `defaultCommands.ts`, add commands like:

```ts
registerCommand({
  id: 'tool.window-casement',
  label: 'Place Casement Window',
  keywords: ['casement', 'window', 'Flügelfenster', 'Einfachflügel'],
  category: 'tool',
  isAvailable: () => true,
  invoke: (ctx) => {
    // activate window tool with casement preset
    startPlanTool(ctx, 'window');
    // set options bar values if possible
  },
});
```

Add similar commands for `tool.window-sliding`, `tool.door-sliding`, `tool.door-double-leaf`.

Minimum viable: just the data file and 1–2 palette commands are enough.

### E — Tests

Create `packages/web/src/tools/windowDoorPresets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { WINDOW_PRESETS, DOOR_PRESETS } from './windowDoorPresets';

describe('windowDoorPresets — §3.6.2', () => {
  it('has at least 5 window presets', () => {
    expect(WINDOW_PRESETS.length).toBeGreaterThanOrEqual(5);
  });

  it('has at least 3 door presets', () => {
    expect(DOOR_PRESETS.length).toBeGreaterThanOrEqual(3);
  });

  it('all window presets have positive dimensions', () => {
    for (const p of WINDOW_PRESETS) {
      expect(p.widthMm).toBeGreaterThan(0);
      expect(p.heightMm).toBeGreaterThan(0);
    }
  });

  it('all door presets have positive dimensions', () => {
    for (const p of DOOR_PRESETS) {
      expect(p.widthMm).toBeGreaterThan(0);
      expect(p.heightMm).toBeGreaterThan(0);
    }
  });

  it('window preset IDs are unique', () => {
    const ids = WINDOW_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('door preset IDs are unique', () => {
    const ids = DOOR_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes casement window preset', () => {
    expect(WINDOW_PRESETS.some((p) => p.windowStyle === 'casement')).toBe(true);
  });

  it('includes sliding door preset', () => {
    expect(DOOR_PRESETS.some((p) => p.doorStyle === 'sliding')).toBe(true);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave24/E): window/door type presets expansion — WINDOW_PRESETS + DOOR_PRESETS + windowStyle/doorStyle fields + 8 tests (§3.6.2)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 8 tests.
