# Wave 18 — WP-G: Edit Wall Profile — Non-Rectangular Cross-Section (§3.5.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                          — wall element type
packages/web/src/plan/PlanCanvas.tsx                — plan canvas
packages/web/src/tools/toolGrammar.ts               — grammars
packages/web/src/viewport/meshBuilders.ts           — makeWallMesh (read carefully)
packages/web/src/workspace/inspector/InspectorContent.tsx — wall inspector
packages/web/src/plan/symbology.ts                  — plan wall rendering
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Search for `profilePoints`, `wallProfile`, `editProfile`, `wall.*profile`, `nonRectangular` in the codebase. Also read `makeWallMesh` in full.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: read the `wall` element type fully — does `profilePoints` or `profileMm` exist?
2. `meshBuilders.ts`: find `makeWallMesh` or `buildWallMesh` — read FULLY. How does it build the 3D geometry?
3. `toolGrammar.ts`: search for `EditProfile` or `WallProfileState` — does this grammar exist?
4. `symbology.ts`: find the wall plan rendering — how is the wall outline drawn?
5. `InspectorContent.tsx` `case 'wall':`: read the inspector — is there an "Edit Profile" button?

---

## Tasks

### A — Wall element additional fields in `core/index.ts`

Add optional fields to the `wall` element (if not present):

```ts
/**
 * Custom cross-section profile points for the wall elevation face.
 * Points are in local wall space: X = horizontal (0 to wallLength), Y = vertical (0 to heightMm).
 * When set, the wall mesh uses this profile instead of a rectangular box.
 * Points form a closed polygon.
 */
profilePoints?: { xPct: number; yPct: number }[];

/** Whether the wall is in edit-profile mode (UI flag only, not persisted). */
editProfileActive?: boolean;
```

---

### B — `WallProfileState` grammar in `toolGrammar.ts`

Create an edit-profile grammar for walls:

```ts
export type WallProfileState =
  | { phase: 'idle' }
  | { phase: 'editing'; wallId: string; points: { xPct: number; yPct: number }[] };

export type WallProfileEffect =
  | { kind: 'commitWallProfile'; wallId: string; points: { xPct: number; yPct: number }[] };

export function initialWallProfileState(): WallProfileState {
  return { phase: 'idle' };
}

export function reduceWallProfile(
  state: WallProfileState,
  event: ToolEvent,
): { state: WallProfileState; effect?: WallProfileEffect } {
  switch (event.type) {
    case 'activate': {
      // Needs wallId from context
      const wallId = (event as any).wallId as string | undefined;
      if (!wallId) return { state };
      return { state: { phase: 'editing', wallId, points: [] } };
    }
    case 'click': {
      if (state.phase !== 'editing') return { state };
      // Clamp to [0,1] range
      const xPct = Math.max(0, Math.min(1, (event as any).xPct ?? 0.5));
      const yPct = Math.max(0, Math.min(1, (event as any).yPct ?? 0.5));
      return { state: { ...state, points: [...state.points, { xPct, yPct }] } };
    }
    case 'confirm':
    case 'Enter': {
      if (state.phase !== 'editing' || state.points.length < 3) return { state };
      return {
        state: { phase: 'idle' },
        effect: { kind: 'commitWallProfile', wallId: state.wallId, points: state.points },
      };
    }
    case 'Escape':
    case 'deactivate':
      return { state: { phase: 'idle' } };
    default:
      return { state };
  }
}
```

Export all three: `WallProfileState`, `reduceWallProfile`, `initialWallProfileState`.

---

### C — Profile mesh builder

Create `packages/web/src/viewport/meshBuilders.wallProfile.ts`:

```ts
import * as THREE from 'three';

type ProfilePoint = { xPct: number; yPct: number };

/**
 * Builds a wall mesh from a custom profile polygon.
 * profilePoints: array of { xPct, yPct } where xPct ∈ [0,1] (wall length ratio), yPct ∈ [0,1] (height ratio).
 * Wall is extruded from the profile in the perpendicular direction for wallThicknessMm.
 */
export function buildProfiledWallMesh(
  lengthMm: number,
  heightMm: number,
  thicknessMm: number,
  profilePoints: ProfilePoint[],
  color = '#d0c8b0',
): THREE.Mesh {
  if (profilePoints.length < 3) return new THREE.Mesh();

  const shape = new THREE.Shape();
  const first = profilePoints[0];
  shape.moveTo(first.xPct * lengthMm / 1000, first.yPct * heightMm / 1000);
  for (let i = 1; i < profilePoints.length; i++) {
    shape.lineTo(profilePoints[i].xPct * lengthMm / 1000, profilePoints[i].yPct * heightMm / 1000);
  }
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thicknessMm / 1000,
    bevelEnabled: false,
  });
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  return mesh;
}
```

---

### D — Wire into `meshBuilders.ts`

In `makeWallMesh` (or `buildWallMesh`), check if `wall.profilePoints` is defined and non-empty. If so, call `buildProfiledWallMesh(lengthMm, heightMm, thicknessMm, wall.profilePoints)` instead of the standard BoxGeometry.

```ts
if (wall.profilePoints && wall.profilePoints.length >= 3) {
  return buildProfiledWallMesh(lengthMm, heightMm, thicknessMm, wall.profilePoints);
}
// else fall through to standard box mesh
```

---

### E — Inspector button to enter edit-profile mode

In `InspectorContent.tsx`, `case 'wall':`, add an "Edit Profile" button and a "Reset Profile" button:

```tsx
<button data-testid="inspector-wall-edit-profile"
  onClick={() => onPropertyChange('editProfileActive', true)}>
  Edit Profile
</button>
{el.profilePoints && el.profilePoints.length > 0 && (
  <button data-testid="inspector-wall-reset-profile"
    onClick={() => onPropertyChange('profilePoints', [])}>
    Reset to Rectangular
  </button>
)}
{el.profilePoints && (
  <span data-testid="inspector-wall-profile-point-count">
    {el.profilePoints.length} profile points
  </span>
)}
```

---

### F — `Workspace.tsx` handler for `commitWallProfile`

Wire the palette command + a handler for the effect. In `Workspace.tsx`, when a `commitWallProfile` semantic command arrives:

```ts
case 'commitWallProfile': {
  const wall = elementsById[cmd.wallId];
  if (wall?.kind === 'wall') {
    (wall as any).profilePoints = cmd.points;
    (wall as any).editProfileActive = false;
  }
  break;
}
```

Add command type in `core/index.ts`:
```ts
| { type: 'commitWallProfile'; wallId: string; points: { xPct: number; yPct: number }[] }
```

---

### G — Palette command + capability graph

In `defaultCommands.ts`:
```ts
{ id: 'modify.edit-wall-profile', label: 'Edit Wall Profile',
  keywords: ['wall', 'profile', 'edit', 'shape', 'non-rectangular'],
  category: 'command', invoke: (ctx) => ctx.startEditWallProfile?.() }
```

In `commandCapabilities.ts`:
```ts
{ id: 'modify.edit-wall-profile', scope: 'selection', intendedModes: ['plan'], precondition: 'selected-wall' },
```

---

### H — Tests

`packages/web/src/viewport/meshBuilders.wallProfile.test.ts`:

```ts
describe('buildProfiledWallMesh — §3.5.5', () => {
  it('returns empty Mesh for fewer than 3 profile points', () => { ... });
  it('returns a Mesh for a valid triangle profile', () => { ... });
  it('Mesh geometry is not null', () => { ... });
});

describe('reduceWallProfile grammar — §3.5.5', () => {
  it('starts in idle phase', () => { ... });
  it('activate with wallId moves to editing', () => { ... });
  it('click accumulates profile points', () => { ... });
  it('Enter with 3+ points emits commitWallProfile', () => { ... });
  it('Enter with fewer than 3 points does nothing', () => { ... });
  it('Escape returns to idle', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave18/G): edit wall profile — non-rectangular cross-section sketch + profiled mesh builder (§3.5.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new wall profile tests.
