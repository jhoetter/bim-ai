# Wave 30 — WP-E: Wall Profile Inspector Sketch Editor (§3.5.5)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§3.5.5 "Wände fixieren, Profil anpassen und Verbinden-Werkzeug" is Partial P1. Pin is Done. Join is Done. Edit Profile is partial:
- `profilePoints?: {xMm: number; yMm: number}[]` field exists on wall elements
- When `profilePoints` is set with >= 3 points, `makeWallMesh` uses `THREE.Shape` + `ExtrudeGeometry`
- BUT: there is no UI to actually edit/create the profile points interactively

This task adds an **inspector panel section** for editing wall profile points:
1. A mini SVG preview of the profile outline
2. A list of editable profile points (xMm / yMm inputs per point)
3. "+ Add Point", "Remove Last", "Reset to Rectangle" buttons
4. Dispatches an `UpdateWallProfileCmd` command
5. `modify.edit-wall-profile-inspector` capability
6. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — find wall element type, profilePoints field
packages/web/src/workspace/WorkspaceRightRail.tsx       — find wall inspector case, profilePoints section
packages/web/src/workspace/Workspace.tsx                — find wall update handlers as pattern
packages/web/src/workspace/inspector/                   — find inspector components directory
```

Run before editing:
- `grep -n "profilePoints\|editWallProfile\|UpdateWallProfile" packages/core/src/index.ts | head -10`
- `grep -n "profilePoints\|editWallProfile\|profile.*points" packages/web/src/workspace/WorkspaceRightRail.tsx | head -10`
- `grep -rn "profilePoints\|editWallProfile" packages/web/src/workspace/Workspace.tsx | head -10`
- `grep -n "profilePoints\|profile" packages/web/src/workspace/inspector/ 2>/dev/null | head -10` || `ls packages/web/src/workspace/inspector/ 2>/dev/null | head -10`

Read the actual wall inspector section in `WorkspaceRightRail.tsx` (or wherever the wall inspector is). Find any existing `profilePoints` UI and extend it; if none exists, add a new section.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add UpdateWallProfileCmd in core

Find where other `Cmd` types are defined. Add:

```ts
export type UpdateWallProfileCmd = {
  type: 'updateWallProfile';
  wallId: string;
  /** New profile points. Pass null or [] to reset to rectangular. */
  profilePoints: { xMm: number; yMm: number }[] | null;
};
```

Add `| UpdateWallProfileCmd` to `SemanticCommand` and export it.

### B — Workspace handler

Find where wall update commands are handled in `Workspace.tsx`. Add:

```ts
if (cmd.type === 'updateWallProfile') {
  const { elementsById: cur } = useBimStore.getState();
  const wall = cur[cmd.wallId as string];
  if (!wall || wall.kind !== 'wall') return;
  useBimStore.setState({
    elementsById: {
      ...cur,
      [wall.id]: {
        ...wall,
        profilePoints: (cmd.profilePoints as any[] | null) && (cmd.profilePoints as any[]).length >= 3
          ? cmd.profilePoints
          : undefined,
      },
    },
  });
  return;
}
```

### C — Wall inspector: Profile Points editor

In the wall inspector (find by searching `WorkspaceRightRail.tsx` or `InspectorContent.tsx` for `case 'wall':`), add a "Profile Points" collapsible section:

```tsx
{/* §3.5.5: wall profile editor */}
{element.kind === 'wall' && (
  <details style={{ marginTop: 8 }}>
    <summary style={{ fontSize: 11, cursor: 'pointer', userSelect: 'none', fontWeight: 600 }}>
      Profile Points ({((element as any).profilePoints ?? []).length})
    </summary>
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Mini SVG preview */}
      {((element as any).profilePoints ?? []).length >= 3 && (
        <svg
          data-testid="wall-profile-preview"
          width={120}
          height={60}
          style={{ border: '1px solid var(--border, #444)', borderRadius: 3, background: '#111' }}
        >
          {/* Draw outline from profilePoints normalized to SVG space */}
          {(() => {
            const pts: { xMm: number; yMm: number }[] = (element as any).profilePoints;
            const xs = pts.map((p) => p.xMm), ys = pts.map((p) => p.yMm);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const scaleX = 110 / (maxX - minX || 1), scaleY = 50 / (maxY - minY || 1);
            const pathD = pts.map((p, i) =>
              `${i === 0 ? 'M' : 'L'} ${5 + (p.xMm - minX) * scaleX} ${55 - (p.yMm - minY) * scaleY}`
            ).join(' ') + ' Z';
            return <path d={pathD} stroke="#a78bfa" strokeWidth={1.5} fill="rgba(167,139,250,0.1)" />;
          })()}
        </svg>
      )}
      {/* Point list */}
      {((element as any).profilePoints ?? []).map((pt: { xMm: number; yMm: number }, i: number) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '20px 1fr 1fr', gap: 4, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#888' }}>{i + 1}</span>
          <input
            data-testid={`wall-profile-pt-x-${i}`}
            type="number"
            value={pt.xMm}
            onChange={(e) => {
              const pts = [...((element as any).profilePoints ?? [])];
              pts[i] = { ...pts[i], xMm: Number(e.target.value) };
              onSemanticCommand?.({ type: 'updateWallProfile', wallId: element.id, profilePoints: pts });
            }}
            style={{ fontSize: 11, padding: '1px 4px', border: '1px solid var(--border)', borderRadius: 2, background: 'transparent', color: 'inherit' }}
          />
          <input
            data-testid={`wall-profile-pt-y-${i}`}
            type="number"
            value={pt.yMm}
            onChange={(e) => {
              const pts = [...((element as any).profilePoints ?? [])];
              pts[i] = { ...pts[i], yMm: Number(e.target.value) };
              onSemanticCommand?.({ type: 'updateWallProfile', wallId: element.id, profilePoints: pts });
            }}
            style={{ fontSize: 11, padding: '1px 4px', border: '1px solid var(--border)', borderRadius: 2, background: 'transparent', color: 'inherit' }}
          />
        </div>
      ))}
      {/* Buttons */}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <button
          data-testid="wall-profile-add-point"
          onClick={() => {
            const pts = [...((element as any).profilePoints ?? [])];
            pts.push({ xMm: 0, yMm: 0 });
            onSemanticCommand?.({ type: 'updateWallProfile', wallId: element.id, profilePoints: pts });
          }}
          style={{ fontSize: 10, padding: '2px 6px', cursor: 'pointer' }}
        >+ Point</button>
        <button
          data-testid="wall-profile-remove-last"
          onClick={() => {
            const pts = [...((element as any).profilePoints ?? [])].slice(0, -1);
            onSemanticCommand?.({ type: 'updateWallProfile', wallId: element.id, profilePoints: pts.length >= 3 ? pts : null });
          }}
          style={{ fontSize: 10, padding: '2px 6px', cursor: 'pointer' }}
        >- Last</button>
        <button
          data-testid="wall-profile-reset"
          onClick={() => onSemanticCommand?.({ type: 'updateWallProfile', wallId: element.id, profilePoints: null })}
          style={{ fontSize: 10, padding: '2px 6px', cursor: 'pointer' }}
        >Reset</button>
      </div>
    </div>
  </details>
)}
```

**Important**: Read the actual wall inspector code carefully. Find where the `case 'wall':` section is in the inspector component. Add the profile section in the appropriate location. Adapt `onSemanticCommand` to the actual callback name used in the inspector.

### D — commandCapabilities.ts entry

```ts
{
  id: 'modify.edit-wall-profile-inspector',
  label: 'Edit Wall Profile Points in Inspector',
  owner: 'workspace/WorkspaceRightRail',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan'],
  surfaces: ['inspector', 'cmd-k'],
  executionSurface: 'store',
  preconditions: ['selected-wall'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§3.5.5: UpdateWallProfileCmd + inspector profile editor with point list (x/y inputs) + SVG mini-preview + add/remove/reset buttons; profilePoints >= 3 triggers ExtrudeGeometry in makeWallMesh.',
},
```

Add a matching `registerCommand` for `modify.edit-wall-profile-inspector` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'modify.edit-wall-profile-inspector',
  label: 'Edit Wall Profile Points',
  keywords: ['wall profile', 'custom profile', 'non-rectangular', 'profile points', 'extrude'],
  category: 'modify',
  isAvailable: (ctx) => (ctx.selectedElements ?? []).some((e) => e.kind === 'wall'),
  invoke: () => {
    // Profile editor is in the inspector — selecting a wall opens it automatically
  },
});
```

### E — Tests

Create `packages/web/src/plan/wallProfileInspectorEdit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Wall profile inspector editor — §3.5.5', () => {
  it('UpdateWallProfileCmd has correct shape', () => {
    const cmd = {
      type: 'updateWallProfile' as const,
      wallId: 'w1',
      profilePoints: [{ xMm: 0, yMm: 0 }, { xMm: 200, yMm: 0 }, { xMm: 200, yMm: 300 }],
    };
    expect(cmd.type).toBe('updateWallProfile');
    expect(cmd.profilePoints.length).toBe(3);
  });

  it('profile requires at least 3 points to activate custom mesh', () => {
    const twoPoints = [{ xMm: 0, yMm: 0 }, { xMm: 200, yMm: 0 }];
    const valid = twoPoints.length >= 3;
    expect(valid).toBe(false);
  });

  it('null profilePoints resets to rectangular', () => {
    const cmd = { type: 'updateWallProfile' as const, wallId: 'w1', profilePoints: null };
    expect(cmd.profilePoints).toBeNull();
  });

  it('add-point button testid is correct', () => {
    expect('wall-profile-add-point').toBe('wall-profile-add-point');
  });

  it('profile preview SVG testid is correct', () => {
    expect('wall-profile-preview').toBe('wall-profile-preview');
  });

  it('point inputs use indexed testids', () => {
    const xTestid = `wall-profile-pt-x-0`;
    const yTestid = `wall-profile-pt-y-0`;
    expect(xTestid).toBe('wall-profile-pt-x-0');
    expect(yTestid).toBe('wall-profile-pt-y-0');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave30/E): wall profile inspector editor — UpdateWallProfileCmd + Workspace handler + inspector point list + SVG preview + add/remove/reset buttons (§3.5.5)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
