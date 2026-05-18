# Wave 26 — WP-A: Paint Surface Tool (§3.3.7)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§3.3.7 "Gruppe Ansicht" is Partial. Linework override is already done (wave 15). What's missing is **Paint surface** — assigning a material to an individual element face, which is a core Revit Modify → View workflow.

This task adds:
1. `PaintFaceCmd` / `UnpaintFaceCmd` in core
2. `faceOverrides?: Record<string, string>` on wall/floor elements (keyed by faceKey, value = materialKey)
3. `'paint'` tool (hotkey `PA`) — click a wall to set its face material
4. `UnpaintFaceCmd` to clear an override
5. Inspector section on painted elements showing face overrides with a remove button
6. Tests

---

## Repo orientation

```
packages/core/src/index.ts                        — find wall element, lineworkOverrides pattern on plan_view
packages/web/src/workspace/Workspace.tsx          — find applyLineworkOverride handler as pattern
packages/web/src/plan/PlanCanvas.tsx              — find case 'linework': as pattern for tool wiring
packages/web/src/cmdPalette/defaultCommands.ts    — find 'modify.linework-override' as pattern
packages/web/src/workspace/commandCapabilities.ts — find 'modify.linework-override' as pattern
```

Run before editing:
- `grep -n "lineworkOverrides\|applyLineworkOverride\|linework" packages/core/src/index.ts | head -10`
- `grep -n "applyLineworkOverride\|handleLinework" packages/web/src/workspace/Workspace.tsx | head -10`
- `grep -n "case 'linework'" packages/web/src/plan/PlanCanvas.tsx | head -5`
- `grep -n "faceOverrides\|paintFace\|PaintFace" packages/core/src/index.ts | head -5`

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add faceOverrides to wall and floor elements in packages/core/src/index.ts

Find the wall element (kind: 'wall'). Add:
```ts
/** Per-face material override. Key: face identifier (e.g. 'front', 'back', 'top', 'bottom'). Value: materialKey string. */
faceOverrides?: Record<string, string>;
```

Do the same for the floor element (kind: 'floor').

### B — Add PaintFaceCmd and UnpaintFaceCmd

Find where `ApplyLineworkOverrideCmd` is defined (near other annotation commands). Add:

```ts
export type PaintFaceCmd = {
  type: 'paintFace';
  elementId: string;
  /** Face identifier: 'front' | 'back' | 'top' | 'bottom' | 'inner' | 'outer' */
  faceKey: string;
  materialKey: string;
};

export type UnpaintFaceCmd = {
  type: 'unpaintFace';
  elementId: string;
  faceKey: string;
};
```

Add both to `SemanticCommand` and export them.

### C — Workspace handlers in Workspace.tsx

Find the `applyLineworkOverride` handler. Add nearby:

```ts
if (cmd.type === 'paintFace') {
  const { elementsById: cur } = useBimStore.getState();
  const el = cur[cmd.elementId as string];
  if (!el) return;
  const overrides = { ...((el as any).faceOverrides ?? {}), [cmd.faceKey as string]: cmd.materialKey as string };
  useBimStore.setState({
    elementsById: { ...cur, [el.id]: { ...el, faceOverrides: overrides } as any },
  });
  return;
}
if (cmd.type === 'unpaintFace') {
  const { elementsById: cur } = useBimStore.getState();
  const el = cur[cmd.elementId as string];
  if (!el) return;
  const overrides = { ...((el as any).faceOverrides ?? {}) };
  delete overrides[cmd.faceKey as string];
  useBimStore.setState({
    elementsById: { ...cur, [el.id]: { ...el, faceOverrides: overrides } as any },
  });
  return;
}
```

### D — Register 'paint' tool in tool registry

Find the tool registry (search for `'linework'` or `ToolId` definitions). Add:

```ts
{
  id: 'paint',
  hotkey: 'PA',
  label: 'Paint Surface',
  modes: ['plan'],
  category: 'modify',
}
```

### E — PlanCanvas wiring

Find `case 'linework':` in `PlanCanvas.tsx`. Add nearby:

```ts
case 'paint': {
  if (event.type === 'click' && event.bimPickId) {
    // Default to painting the 'front' face with the options bar material
    onSemanticCommand?.({
      type: 'paintFace',
      elementId: event.bimPickId,
      faceKey: 'front',
      materialKey: paintMaterial ?? 'concrete',
    });
  }
  break;
}
```

Where `paintMaterial` is a local state variable (default `'concrete'`). Add a `paintMaterial` state variable and expose it in an OptionsBar section for the paint tool:

```tsx
// In the paint tool options bar section:
<select
  data-testid="options-paint-material"
  value={paintMaterial}
  onChange={(e) => setPaintMaterial(e.target.value)}
>
  <option value="concrete">Concrete</option>
  <option value="brick">Brick</option>
  <option value="wood">Wood</option>
  <option value="steel">Steel</option>
  <option value="glass">Glass</option>
</select>
```

**Important**: Read the actual PlanCanvas structure carefully. The options bar pattern may differ. Adapt to what exists.

### F — commandCapabilities.ts entry

```ts
{
  id: 'modify.paint-face',
  label: 'Paint Surface',
  owner: 'plan/PlanCanvas',
  group: 'modify',
  scope: 'canvas',
  intendedModes: ['plan'],
  surfaces: ['tool-palette'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 7,
  notes: '§3.3.7: assigns a material to an element face; stores faceOverrides on wall/floor elements.',
},
```

### G — Tests

Create `packages/web/src/plan/paintSurface.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('PaintFace / UnpaintFace — §3.3.7', () => {
  it('PaintFaceCmd has correct shape', () => {
    const cmd = { type: 'paintFace' as const, elementId: 'w1', faceKey: 'front', materialKey: 'brick' };
    expect(cmd.type).toBe('paintFace');
    expect(cmd.faceKey).toBe('front');
    expect(cmd.materialKey).toBe('brick');
  });

  it('UnpaintFaceCmd has correct shape', () => {
    const cmd = { type: 'unpaintFace' as const, elementId: 'w1', faceKey: 'front' };
    expect(cmd.type).toBe('unpaintFace');
  });

  it('faceOverrides record stores per-face material', () => {
    const overrides: Record<string, string> = { front: 'brick', back: 'concrete' };
    expect(overrides['front']).toBe('brick');
    expect(overrides['back']).toBe('concrete');
  });

  it('unpaint removes face override', () => {
    const overrides: Record<string, string> = { front: 'brick', back: 'concrete' };
    delete overrides['front'];
    expect(overrides['front']).toBeUndefined();
    expect(overrides['back']).toBe('concrete');
  });

  it('faceOverrides is optional — undefined means no overrides', () => {
    const el: any = { kind: 'wall', id: 'w1' };
    expect((el.faceOverrides ?? {})).toEqual({});
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave26/A): paint surface tool — PaintFaceCmd + UnpaintFaceCmd + faceOverrides on wall/floor + 'paint' tool PA hotkey + Workspace handlers (§3.3.7)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
