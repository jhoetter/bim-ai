# Wave 26 — WP-D: Material Tag Completion (§4.11.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§4.11.3 "Material-Bauelement" (material tag) is Partial P2. A `material-tag` ToolId (hotkey `MT`) is registered with a single-click grammar. The plan renderer draws a material name label. Live layer lookup resolves `wallTypeId → layer[layerIndex].materialKey` when `textOverride` is absent.

What's missing to make this section Done:

- Leader line from tag to target element (like the other element tags)
- Support for tagging non-wall elements (floor material, ceiling/roof material)
- Inspector for material_tag element: textOverride input, leader target display, material readout
- Proper tag format (label with material name, framed in a box)

This task completes the material tag implementation.

---

## Repo orientation

```
packages/core/src/index.ts                           — find material_tag element type (kind: 'material_tag')
packages/web/src/plan/PlanCanvas.tsx                 — find case 'material-tag': for placement wiring
packages/web/src/workspace/inspector/InspectorContent.tsx — find case 'material_tag': or 'placed_tag':
packages/web/src/viewport/symbology.ts               — find material tag rendering (search 'material_tag' or 'material-tag')
```

Run before editing:

- `grep -n "material_tag\|material-tag\|materialTag" packages/core/src/index.ts | head -10`
- `grep -n "material_tag\|material-tag" packages/web/src/viewport/symbology.ts | head -10`
- `grep -n "case 'material_tag'\|case 'placed_tag'" packages/web/src/workspace/inspector/InspectorContent.tsx | head -5`
- `grep -n "leaderEnd\|LeaderEnd\|leader_end" packages/core/src/index.ts | head -5`

Read the `placed_tag` element type carefully — `material_tag` may share the same shape or be similar.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Audit the current material_tag element type

Read the `material_tag` type in `packages/core/src/index.ts`. Confirm it has:

- `id: string`
- `targetElementId: string`
- `positionMm: { xMm: number; yMm: number }`
- `levelId: string`
- `textOverride?: string`
- `layerIndex?: number` (which layer of a wall type to read the material from)
- `leaderEndMm?: { xMm: number; yMm: number }` (end of leader line)

If any of these fields are missing, add them.

### B — Add leaderEndMm to material_tag (if missing)

If `leaderEndMm` is not on the `material_tag` type, add it:

```ts
/** Optional leader line end point (tip touching the element). */
leaderEndMm?: { xMm: number; yMm: number };
/** Index of the wall type layer whose material to show. Defaults to 0 (first layer). */
layerIndex?: number;
```

### C — Improve plan renderer for material_tag in symbology.ts

Find where `material_tag` elements are rendered in `symbology.ts`. The current implementation draws just a text label. Improve it to:

1. Draw a rectangular tag box around the material name text (using `THREE.LineSegments` or a plane geometry)
2. Draw a leader line from the tag position to the `leaderEndMm` point (if set) — using `THREE.Line`
3. Ensure the label reads the material name from the resolved layer, or falls back to `textOverride`

Pattern from `tagLeaderLineThree.ts` (which does this for `placed_tag`) — reuse that utility if it exists.

**Important**: Read the actual symbology.ts material_tag rendering carefully before editing. If there's already a leader line renderer, just ensure `leaderEndMm` is wired in.

### D — Inspector case for material_tag

Find `case 'material_tag':` in `InspectorContent.tsx`. If it doesn't exist, add it. If it exists, enhance it:

```tsx
case 'material_tag': {
  const tag = el as any;
  const resolvedMaterial = /* read from elementsById */
    (() => {
      if (tag.textOverride) return tag.textOverride;
      const target = elementsById?.[tag.targetElementId];
      if (!target) return '—';
      const wallTypeId = (target as any).wallTypeId;
      const wallType = wallTypeId ? elementsById?.[wallTypeId] : null;
      const layers = (wallType as any)?.layers;
      if (layers && layers.length > 0) {
        const idx = tag.layerIndex ?? 0;
        return layers[idx]?.materialKey ?? '—';
      }
      return (target as any).materialKey ?? '—';
    })();

  return (
    <div style={{ padding: 8 }}>
      <div className="text-xs font-semibold mb-2">Material Tag</div>
      <div style={{ fontSize: 11, marginBottom: 4 }}>
        Material: <strong data-testid="inspector-material-tag-resolved">{resolvedMaterial}</strong>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, width: 80 }}>Override</span>
        <input
          data-testid="inspector-material-tag-override"
          type="text"
          value={tag.textOverride ?? ''}
          placeholder="(auto)"
          style={{ fontSize: 11, flex: 1, padding: '1px 4px' }}
          onChange={(e) =>
            onSemanticCommand?.({
              type: 'updateElementProperty',
              elementId: el.id,
              property: 'textOverride',
              value: e.target.value || null,
            })
          }
        />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 11, width: 80 }}>Layer</span>
        <input
          data-testid="inspector-material-tag-layer"
          type="number"
          min={0}
          value={tag.layerIndex ?? 0}
          style={{ fontSize: 11, width: 40, padding: '1px 4px' }}
          onChange={(e) =>
            onSemanticCommand?.({
              type: 'updateElementProperty',
              elementId: el.id,
              property: 'layerIndex',
              value: parseInt(e.target.value, 10),
            })
          }
        />
      </div>
    </div>
  );
}
```

**Important**: Adapt to the actual `elementsById` access pattern in InspectorContent.tsx (it may be a prop or from a hook). Check how other inspector cases access elements.

### E — PlanCanvas placement: set leaderEndMm on click position

In `PlanCanvas.tsx`, find `case 'material-tag':`. Ensure that when a wall/floor element is clicked:

1. The element ID is stored as `targetElementId`
2. The click world position is stored as `leaderEndMm` (the tag is offset slightly from the click)
3. The tag `positionMm` is the click point offset by ~500mm diagonally

If the existing implementation already does this, skip; otherwise update the grammar commit.

### F — Tests

Create `packages/web/src/plan/materialTag.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Material tag completion — §4.11.3', () => {
  it('material_tag shape includes required fields', () => {
    const tag: any = {
      kind: 'material_tag',
      id: 'mt1',
      targetElementId: 'wall-01',
      positionMm: { xMm: 1000, yMm: 2000 },
      levelId: 'l1',
    };
    expect(tag.kind).toBe('material_tag');
    expect(tag.targetElementId).toBe('wall-01');
  });

  it('textOverride takes precedence over auto-resolved material', () => {
    const tag: any = { textOverride: 'Custom Material', layerIndex: 0 };
    const resolved = tag.textOverride ?? 'fallback';
    expect(resolved).toBe('Custom Material');
  });

  it('leaderEndMm is optional', () => {
    const tag: any = {
      kind: 'material_tag',
      id: 'mt1',
      targetElementId: 'w1',
      positionMm: { xMm: 0, yMm: 0 },
      levelId: 'l1',
    };
    expect(tag.leaderEndMm).toBeUndefined();
  });

  it('layerIndex defaults to 0', () => {
    const tag: any = {
      kind: 'material_tag',
      id: 'mt1',
      targetElementId: 'w1',
      positionMm: { xMm: 0, yMm: 0 },
      levelId: 'l1',
    };
    expect(tag.layerIndex ?? 0).toBe(0);
  });

  it('resolves wall type first layer material', () => {
    const layers = [{ materialKey: 'concrete' }, { materialKey: 'insulation' }];
    const layerIndex = 0;
    expect(layers[layerIndex]?.materialKey).toBe('concrete');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave26/D): material tag completion — leaderEndMm + leader line renderer + layerIndex + inspector override/layer inputs (§4.11.3)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
