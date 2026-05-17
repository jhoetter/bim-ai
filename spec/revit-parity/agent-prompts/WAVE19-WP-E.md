# Wave 19 — WP-E: Edit Wall Profile — Inspector + Workspace Wiring (§3.5.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context — what Wave 18 already delivered

Wave 18 WP-G created:
- `packages/web/src/viewport/meshBuilders.wallProfile.ts` — `buildProfiledWallMesh()`
- `packages/web/src/viewport/meshBuilders.wallProfile.test.ts` — 3 tests
- Added to `toolGrammar.ts`: `WallProfileState`, `reduceWallProfile`, `initialWallProfileState`
- Test file for grammar in `toolGrammar` (inline in the grammar additions)

**Still missing:**
- `profilePoints` + `editProfileActive` fields on `wall` element in `core/index.ts`
- `commitWallProfile` command type in `core/index.ts`
- `buildProfiledWallMesh` wired into `meshBuilders.ts` `case 'wall':` branch
- `Workspace.tsx` handler for `commitWallProfile`
- Inspector "Edit Profile" button + "Reset Profile" button + point count display
- Palette command `modify.edit-wall-profile` + capability graph entry

---

## Repo orientation

```
packages/core/src/index.ts
packages/web/src/viewport/meshBuilders.wallProfile.ts  — buildProfiledWallMesh (already exists)
packages/web/src/viewport/meshBuilders.ts              — makeWallMesh (wire it in)
packages/web/src/tools/toolGrammar.ts                  — reduceWallProfile (already here)
packages/web/src/workspace/Workspace.tsx
packages/web/src/workspace/inspector/InspectorContent.tsx
packages/web/src/cmdPalette/defaultCommands.ts
packages/web/src/workspace/commandCapabilities.ts
```

Read `meshBuilders.ts` to find `makeWallMesh` (or equivalent). Read `InspectorContent.tsx` `case 'wall':` for the existing inspector layout.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Wall element additional fields in `core/index.ts`

Add to the `wall` element (if not present):
```ts
profilePoints?: { xPct: number; yPct: number }[];
editProfileActive?: boolean;
```

Add command type:
```ts
| { type: 'commitWallProfile'; wallId: string; points: { xPct: number; yPct: number }[] }
```

---

### B — Wire `buildProfiledWallMesh` into `meshBuilders.ts`

In the wall mesh builder function (`makeWallMesh` or `buildWallMesh`), add the profile check near the top:

```ts
import { buildProfiledWallMesh } from './meshBuilders.wallProfile';

// Inside the wall mesh builder, before standard BoxGeometry:
if ((wall as any).profilePoints && (wall as any).profilePoints.length >= 3) {
  const mesh = buildProfiledWallMesh(
    lengthMm,
    heightMm,
    thicknessMm ?? 200,
    (wall as any).profilePoints,
  );
  mesh.userData.bimPickId = wall.id;
  return mesh;
}
// ... existing rectangular mesh code below ...
```

Find `lengthMm`, `heightMm`, `thicknessMm` from the wall element — read how `makeWallMesh` currently extracts them.

---

### C — `Workspace.tsx` handler

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

---

### D — Inspector additions

In `InspectorContent.tsx`, `case 'wall':`, add after the existing wall inspector content:

```tsx
{/* Edit Profile section */}
<div style={{ marginTop: 8 }}>
  <button data-testid="inspector-wall-edit-profile"
    onClick={() => onPropertyChange('editProfileActive', true)}>
    Edit Profile
  </button>
  {(el as any).profilePoints && (el as any).profilePoints.length > 0 && (
    <>
      <span data-testid="inspector-wall-profile-point-count">
        {(el as any).profilePoints.length} profile points
      </span>
      <button data-testid="inspector-wall-reset-profile"
        onClick={() => onPropertyChange('profilePoints', [])}>
        Reset to Rectangular
      </button>
    </>
  )}
</div>
```

---

### E — Palette command + capability graph

In `defaultCommands.ts`:
```ts
{ id: 'modify.edit-wall-profile', label: 'Edit Wall Profile',
  keywords: ['wall', 'profile', 'edit', 'shape', 'non-rectangular', 'custom'],
  category: 'command', invoke: (ctx) => {
    const wall = ctx.selectedElements?.find(e => e.kind === 'wall');
    if (wall) void ctx.onPropertyChange?.(wall.id, 'editProfileActive', true);
  } }
```

In `commandCapabilities.ts`:
```ts
{ id: 'modify.edit-wall-profile', scope: 'selection', intendedModes: ['plan'], precondition: 'selected-wall' },
```

---

### F — Tests

`packages/web/src/workspace/inspector/wallProfileInspector.test.tsx`:

```tsx
describe('wall profile inspector — §3.5.5', () => {
  it('renders Edit Profile button', () => { ... });
  it('shows point count when profilePoints is set', () => { ... });
  it('shows Reset button when profile points exist', () => { ... });
  it('does not show Reset button when no profile points', () => { ... });
});

describe('buildProfiledWallMesh wiring — §3.5.5', () => {
  // Import buildProfiledWallMesh directly
  it('returns a Mesh for a valid triangle profile', () => { ... });
  it('returns empty Mesh for fewer than 3 points', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave19/E): edit wall profile — wire profiled mesh + commitWallProfile handler + inspector buttons (§3.5.5)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
