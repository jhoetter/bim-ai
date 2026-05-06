# WP-V2-07 — Curtain Wall Grid Params + Inspector

**Branch:** `feat/wp-v2-07-curtain-wall`
**Wave:** 3, Batch A (start after Wave 2 fully merged to main)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-07 → `done` when merged.

---

## Branch setup (run first)

```bash
git checkout main && git pull && git checkout -b feat/wp-v2-07-curtain-wall
git branch --show-current   # must print: feat/wp-v2-07-curtain-wall
```

---

## Pre-existing test failures (ignore — do not investigate)

- `src/workspace/RedesignedWorkspace.semanticCommand.test.tsx` — flaky URL mock issue.

---

## Context

`makeCurtainWallMesh` (meshBuilders.ts line 1164) currently computes vertical bay count and
horizontal row count from hardcoded panel dimensions (`PANEL_W = 1.5`, `PANEL_H = 1.2`).
This WP adds optional override fields `curtainWallVCount` and `curtainWallHCount` to the wall
element type so the grid can be authored explicitly, and exposes those fields in the Inspector.

---

## Files to touch

| File                                              | Change                                                               |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| `packages/core/src/index.ts`                      | Add `curtainWallVCount`, `curtainWallHCount` optional fields to wall |
| `packages/web/src/viewport/meshBuilders.ts`       | Use wall fields when present in `makeCurtainWallMesh`                |
| `packages/web/src/workspace/InspectorContent.tsx` | Add 2 numeric inputs (visible only when `isCurtainWall`)             |
| `packages/web/src/i18n.ts`                        | Add `cwVCount` and `cwHCount` keys (EN + DE)                         |

Read all 4 files in a single parallel batch before making any edits.

---

## Changes

### 1. `packages/core/src/index.ts`

Add two optional fields to the wall element type.

**Old** (line 191–192):

```ts
      isCurtainWall?: boolean;
      locationLine?: WallLocationLine;
```

**New:**

```ts
      isCurtainWall?: boolean;
      curtainWallVCount?: number | null;
      curtainWallHCount?: number | null;
      locationLine?: WallLocationLine;
```

---

### 2. `packages/web/src/viewport/meshBuilders.ts`

Update `makeCurtainWallMesh` to use the new fields. The current hardcoded section is at lines 1203–1224.

**Old:**

```ts
  const PANEL_W = 1.5;
  const PANEL_H = 1.2;
  const MW = 0.06;

  // Vertical mullions at bay divisions
  const vCount = Math.max(1, Math.round(len / PANEL_W));
  for (let i = 0; i <= vCount; i++) {
    const t = i / vCount;
    const vm = new THREE.Mesh(new THREE.BoxGeometry(MW, height, thick), mullionMat);
    vm.position.set(sx + t * dx, elevM + height / 2, sz + t * dz);
    vm.rotation.y = yaw;
    addEdges(vm);
    group.add(vm);
  }

  // Horizontal mullions at floor divisions
  const hCount = Math.max(1, Math.round(height / PANEL_H));
  for (let i = 0; i <= hCount; i++) {
```

**New:**

```ts
  const PANEL_W = 1.5;
  const PANEL_H = 1.2;
  const MW = 0.06;

  // Vertical mullions at bay divisions
  const vCount =
    wall.curtainWallVCount != null
      ? Math.max(1, wall.curtainWallVCount)
      : Math.max(1, Math.round(len / PANEL_W));
  for (let i = 0; i <= vCount; i++) {
    const t = i / vCount;
    const vm = new THREE.Mesh(new THREE.BoxGeometry(MW, height, thick), mullionMat);
    vm.position.set(sx + t * dx, elevM + height / 2, sz + t * dz);
    vm.rotation.y = yaw;
    addEdges(vm);
    group.add(vm);
  }

  // Horizontal mullions at floor divisions
  const hCount =
    wall.curtainWallHCount != null
      ? Math.max(1, wall.curtainWallHCount)
      : Math.max(1, Math.round(height / PANEL_H));
  for (let i = 0; i <= hCount; i++) {
```

---

### 3. `packages/web/src/workspace/InspectorContent.tsx`

Add two numeric inputs after the curtain wall checkbox (around line 92). They are
conditionally rendered only when `el.isCurtainWall` is true.

**Old** (after curtain wall `</div>`, before wallType row):

```tsx
          </div>

          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">{f('wallType')}</span>
```

**New:**

```tsx
          </div>

          {el.isCurtainWall && (
            <>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">{f('cwVCount')}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="w-16 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  value={el.curtainWallVCount ?? ''}
                  placeholder="auto"
                  onChange={(e2) =>
                    onPropertyChange?.(
                      'curtainWallVCount',
                      e2.target.value === '' ? null : Number(e2.target.value),
                    )
                  }
                />
              </div>
              <div className="flex items-center gap-2 py-0.5">
                <span className="text-xs text-muted w-28 shrink-0">{f('cwHCount')}</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  className="w-16 text-xs bg-surface border border-border rounded px-1 py-0.5"
                  value={el.curtainWallHCount ?? ''}
                  placeholder="auto"
                  onChange={(e2) =>
                    onPropertyChange?.(
                      'curtainWallHCount',
                      e2.target.value === '' ? null : Number(e2.target.value),
                    )
                  }
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-muted w-28 shrink-0">{f('wallType')}</span>
```

---

### 4. `packages/web/src/i18n.ts`

Add two keys in `inspector.fields` for both English (line ~195) and German (line ~838) translations.

**English — old** (inside `inspector.fields`):

```ts
            curtainWall: 'Curtain Wall',
            wallType: 'Wall Type',
```

**English — new:**

```ts
            curtainWall: 'Curtain Wall',
            cwVCount: 'V bays',
            cwHCount: 'H rows',
            wallType: 'Wall Type',
```

**German — old** (inside `inspector.fields`):

```ts
            curtainWall: 'Vorhangfassade',
            wallType: 'Wandtyp',
```

**German — new:**

```ts
            curtainWall: 'Vorhangfassade',
            cwVCount: 'V-Felder',
            cwHCount: 'H-Reihen',
            wallType: 'Wandtyp',
```

---

## Tests to run

```bash
pnpm --filter web typecheck
```

TypeScript will catch any type errors in the wall element usage. No new test file needed.

---

## Commit format

```bash
git add packages/core/src/index.ts \
        packages/web/src/viewport/meshBuilders.ts \
        packages/web/src/workspace/InspectorContent.tsx \
        packages/web/src/i18n.ts
git commit -m "$(cat <<'EOF'
feat(view): WP-V2-07 — curtain wall grid params (vCount/hCount) + Inspector inputs

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push -u origin feat/wp-v2-07-curtain-wall
```
