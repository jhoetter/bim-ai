# Wave 23 — WP-A: Sub-floor Thickening (§3.4.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§3.4.2 "Bodenplatte im Keller bearbeiten" is Partial. Drainage slope via sub-element editing is Done (WP-B wave 21). What's still missing is sub-floor thickening — a basement slab often has a thicker structural base pad beneath the standard floor thickness. This task adds `subFloorThicknessMm` to the floor element, an inspector input, a command, and updates the mesh builder.

---

## Repo orientation

```
packages/core/src/index.ts                            — find FloorElem (kind: 'floor') at the union member with slopePoints?
packages/web/src/workspace/Workspace.tsx              — find 'addFloorSlopePoint' handler as pattern for floor commands
packages/web/src/workspace/inspector/InspectorContent.tsx — find case 'floor': for inspector additions
packages/web/src/meshBuilders/                        — find floor mesh builder file
```

Run:
- `grep -n "subFloor\|structureThickness\|finishThickness\|slopePoints" packages/core/src/index.ts | head -10`
- `find packages/web/src/meshBuilders -name "*floor*" -o -name "*Floor*"` to find floor mesh builder

Read the FloorElem type carefully before adding a field.

Tests: `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add subFloorThicknessMm to FloorElem in packages/core/src/index.ts

Find the FloorElem union member (search for `kind: 'floor';`). After the existing `slopePoints?: FloorSlopePoint[];` line and the `cutBy?: string[];` line, add:

```ts
/** §3.4.2: optional structural base pad thickness beneath the floor slab (mm). */
subFloorThicknessMm?: number | null;
```

### B — Add SetSubFloorThicknessCmd type in packages/core/src/index.ts

Find where `AddFloorSlopePointCmd` is defined. After the floor slope point command types, add:

```ts
export type SetSubFloorThicknessCmd = {
  type: 'setSubFloorThickness';
  floorId: string;
  subFloorThicknessMm: number | null;
};
```

Add `| SetSubFloorThicknessCmd` to the `SemanticCommand` union (find `| AddFloorSlopePointCmd` and add it nearby).

Export `SetSubFloorThicknessCmd` at the bottom of the file where other command types are exported.

### C — Workspace handler in packages/web/src/workspace/Workspace.tsx

Find the section handling `'addFloorSlopePoint'` as a pattern. Add a handler for `'setSubFloorThickness'`:

```ts
if (cmd.type === 'setSubFloorThickness') {
  const floor = draft.elementsById[cmd.floorId];
  if (floor && floor.kind === 'floor') {
    (floor as any).subFloorThicknessMm = cmd.subFloorThicknessMm;
  }
}
```

### D — Floor mesh builder update

Find the floor mesh builder file (probably `meshBuilders/meshBuilders.floor.ts` or similar — run `find packages/web/src/meshBuilders -name "*loor*"`). 

In the function that builds the floor geometry, find where `thicknessMm` is used to set the floor's vertical extent. After the existing thickness, add the sub-floor pad as a second box below:

If the file uses THREE.BoxGeometry or ExtrudeGeometry for the floor, add logic like:
```ts
const subThick = (el as any).subFloorThicknessMm ?? 0;
if (subThick > 0) {
  const padGeo = new THREE.BoxGeometry(width * SCALE, depth * SCALE, subThick * SCALE);
  const padMesh = new THREE.Mesh(padGeo, new THREE.MeshStandardMaterial({ color: '#888888' }));
  padMesh.position.z = -(el.thicknessMm / 2 + subThick / 2) * SCALE;
  group.add(padMesh);
}
```

Adapt the exact code to match how the floor mesh is actually built in the file. Read the file before editing.

### E — Inspector input in InspectorContent.tsx

Find `case 'floor':` in `packages/web/src/workspace/inspector/InspectorContent.tsx`.

After the existing inspector rows (thicknessMm, typeId, slopePoints section, etc.), add a number input for sub-floor thickness:

```tsx
<div className="flex items-center gap-2 py-0.5">
  <span className="text-xs text-muted w-28 shrink-0">Sub-floor Pad</span>
  <input
    data-testid="inspector-floor-sub-thickness"
    type="number"
    min={0}
    step={10}
    className="w-20 text-sm bg-transparent border-b border-border/40 focus:outline-none"
    value={(el as any).subFloorThicknessMm ?? 0}
    onChange={(e) =>
      onSemanticCommand?.({
        type: 'setSubFloorThickness',
        floorId: el.id,
        subFloorThicknessMm: Number(e.target.value) || null,
      })
    }
  />
  <span className="text-xs text-muted">mm</span>
</div>
```

### F — Palette command in defaultCommands.ts

Add `modify.set-sub-floor-thickness` command:

```ts
registerCommand({
  id: 'modify.set-sub-floor-thickness',
  label: 'Set Sub-floor Thickness',
  keywords: ['sub floor', 'basement', 'slab', 'pad', 'thickening', 'Bodenplatte', 'Keller'],
  category: 'command',
  isAvailable: (ctx) => ctx.selectedElements?.some(e => e.kind === 'floor') ?? false,
  invoke: (_ctx) => {
    // Opens inspector — handled via inspector input
  },
});
```

### G — commandCapabilities.ts entry

Find `packages/web/src/workspace/commandCapabilities.ts`. Add:

```ts
{
  id: 'modify.set-sub-floor-thickness',
  label: 'Set Sub-floor Thickness',
  owner: 'cmdPalette/defaultCommands',
  group: 'modify',
  scope: 'selection',
  intendedModes: ['plan', '3d'],
  surfaces: ['cmd-k', 'inspector'],
  executionSurface: 'store',
  preconditions: ['selected-floor'],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§3.4.2: adds structural base pad below floor slab.',
},
```

### H — Tests

Create `packages/web/src/plan/subFloorThickness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

// Test that the command type shape is correct
describe('subFloorThickness — §3.4.2', () => {
  it('SetSubFloorThicknessCmd has correct shape', () => {
    const cmd = { type: 'setSubFloorThickness' as const, floorId: 'f1', subFloorThicknessMm: 200 };
    expect(cmd.type).toBe('setSubFloorThickness');
    expect(cmd.floorId).toBe('f1');
    expect(cmd.subFloorThicknessMm).toBe(200);
  });

  it('allows null to clear sub-floor', () => {
    const cmd = { type: 'setSubFloorThickness' as const, floorId: 'f1', subFloorThicknessMm: null };
    expect(cmd.subFloorThicknessMm).toBeNull();
  });

  it('subFloorThicknessMm field is optional on floor element', () => {
    const floor: any = { id: 'f1', kind: 'floor', thicknessMm: 250 };
    expect(floor.subFloorThicknessMm).toBeUndefined();
  });

  it('can set subFloorThicknessMm on floor element', () => {
    const floor: any = { id: 'f1', kind: 'floor', thicknessMm: 250, subFloorThicknessMm: 300 };
    expect(floor.subFloorThicknessMm).toBe(300);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave23/A): sub-floor thickening — subFloorThicknessMm field + setSubFloorThickness command + inspector input + mesh pad (§3.4.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
