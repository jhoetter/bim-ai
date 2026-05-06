# WP-V2-08 — Ceilings

**Branch:** `feat/wp-v2-08-ceilings`
**Wave:** 3, Batch C (start after WP-V2-06 merged to main)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-08 → `done` when merged.

---

## Branch setup (run first)

```bash
git checkout main && git pull && git checkout -b feat/wp-v2-08-ceilings
git branch --show-current   # must print: feat/wp-v2-08-ceilings
```

---

## Pre-existing test failures (ignore — do not investigate)

- `src/workspace/RedesignedWorkspace.semanticCommand.test.tsx` — flaky URL mock issue.

---

## Context

Add `ceiling` element type end-to-end: core type, sketch polygon tool (same grammar as shaft/room),
plan outline rendering in symbology.ts, 3D flat slab rendering in meshBuilders.ts + Viewport.tsx.

`CeilingIcon` **already exists** in `@bim-ai/icons` (packages/icons/src/index.ts line 93).
It is NOT yet in `packages/ui/src/icons.tsx` — you must add it there.

---

## Files to touch

| File                                        | Change                                                              |
| ------------------------------------------- | ------------------------------------------------------------------- |
| `packages/core/src/index.ts`                | Add `'ceiling'` to `ElemKind`; add ceiling shape to `Element` union |
| `packages/web/src/tools/toolRegistry.ts`    | Add `'ceiling'` to `ToolId`, `getToolRegistry`, `PALETTE_ORDER`     |
| `packages/web/src/state/storeTypes.ts`      | Add `'ceiling'` to `PlanTool`                                       |
| `packages/web/src/tools/toolGrammar.ts`     | Append `CeilingState`/`reduceCeiling`                               |
| `packages/web/src/plan/PlanCanvas.tsx`      | Import + state ref + tool change + click dispatch + escape          |
| `packages/ui/src/icons.tsx`                 | Import `CeilingIcon`; add to `Icons` map + `IconLabels`             |
| `packages/web/src/plan/symbology.ts`        | Add ceiling outline loop in `rebuildPlanMeshes`                     |
| `packages/web/src/viewport/meshBuilders.ts` | Append `makeCeilingMesh`                                            |
| `packages/web/src/Viewport.tsx`             | Import `makeCeilingMesh`; add `case 'ceiling'`                      |
| `packages/web/src/i18n.ts`                  | Add tool labels (EN + DE)                                           |

Read all 10 files in a single parallel batch before making any edits.

---

## Changes

### 1. `packages/core/src/index.ts`

**Edit 1 — add `'ceiling'` to ElemKind** (line 36):

Old:

```ts
  | 'column'
  | 'beam';
```

New:

```ts
  | 'column'
  | 'beam'
  | 'ceiling';
```

Note: after WP-V2-06 is merged, `ElemKind` will end with `| 'column' | 'beam';` — add `'ceiling'` after those.

**Edit 2 — add ceiling shape to Element union** (after the beam member, before the final `;`):

Old:

```ts
  | {
      kind: 'beam';
      id: string;
      name: string;
      levelId: string;
      startMm: XY;
      endMm: XY;
      widthMm: number;
      heightMm: number;
      materialKey?: string | null;
      startColumnId?: string | null;
      endColumnId?: string | null;
    };
```

New:

```ts
  | {
      kind: 'beam';
      id: string;
      name: string;
      levelId: string;
      startMm: XY;
      endMm: XY;
      widthMm: number;
      heightMm: number;
      materialKey?: string | null;
      startColumnId?: string | null;
      endColumnId?: string | null;
    }
  | {
      kind: 'ceiling';
      id: string;
      name: string;
      levelId: string;
      boundaryMm: XY[];
      heightOffsetMm: number;
      thicknessMm: number;
      ceilingTypeId?: string | null;
    };
```

---

### 2. `packages/web/src/tools/toolRegistry.ts`

**Edit 1 — ToolId** (after `| 'beam';`):

Old:

```ts
  | 'column'
  | 'beam';
```

New:

```ts
  | 'column'
  | 'beam'
  | 'ceiling';
```

**Edit 2 — getToolRegistry** — append ceiling entry after beam:

Old:

```ts
    beam: {
      id: 'beam',
      label: t('tools.beam.label'),
      icon: 'beam',
      hotkey: 'BM',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.beam.tooltip'),
    },
  };
}
```

New:

```ts
    beam: {
      id: 'beam',
      label: t('tools.beam.label'),
      icon: 'beam',
      hotkey: 'BM',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.beam.tooltip'),
    },
    ceiling: {
      id: 'ceiling',
      label: t('tools.ceiling.label'),
      icon: 'ceiling',
      hotkey: 'CL',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.ceiling.tooltip'),
    },
  };
}
```

**Edit 3 — PALETTE_ORDER** (after `'beam',`):

Old:

```ts
  'column',
  'beam',
];
```

New:

```ts
  'column',
  'beam',
  'ceiling',
];
```

---

### 3. `packages/web/src/state/storeTypes.ts`

**Edit — PlanTool union** (after `| 'beam';`):

Old:

```ts
  | 'column'
  | 'beam';
```

New:

```ts
  | 'column'
  | 'beam'
  | 'ceiling';
```

---

### 4. `packages/web/src/tools/toolGrammar.ts`

**Append to end of file** (after the closing `}` of `reduceBeam`):

```ts
/* ────────────────────────────────────────────────────────────────────── */
/* C18 Ceiling — sketch polygon (same grammar as Shaft)                     */
/* ────────────────────────────────────────────────────────────────────── */

export type CeilingState =
  | { phase: 'idle' }
  | { phase: 'sketch'; verticesMm: Array<{ xMm: number; yMm: number }> };

export type CeilingEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'close-loop' }
  | { kind: 'cancel' };

export interface CeilingEffect {
  commitCeiling?: { verticesMm: Array<{ xMm: number; yMm: number }> };
  stillActive: boolean;
}

export function initialCeilingState(): CeilingState {
  return { phase: 'idle', verticesMm: [] } as CeilingState;
}

export function reduceCeiling(
  state: CeilingState,
  event: CeilingEvent,
): { state: CeilingState; effect: CeilingEffect } {
  if (event.kind === 'activate') {
    return { state: { phase: 'idle' }, effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: { phase: 'idle' }, effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: { phase: 'idle' }, effect: { stillActive: true } };
  }
  if (event.kind === 'click') {
    const prev = state.phase === 'sketch' ? state.verticesMm : [];
    return {
      state: { phase: 'sketch', verticesMm: [...prev, event.pointMm] },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'close-loop') {
    const verts = state.phase === 'sketch' ? state.verticesMm : [];
    if (verts.length >= 3) {
      return {
        state: { phase: 'idle' },
        effect: { commitCeiling: { verticesMm: verts }, stillActive: true },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}
```

Note: the `initialCeilingState()` function intentionally casts via `as CeilingState` because
`{ phase: 'idle', verticesMm: [] }` technically isn't `| { phase: 'idle' }` without the cast —
keep the cast to avoid a type error, or just return `{ phase: 'idle' } as CeilingState`.

---

### 5. `packages/web/src/plan/PlanCanvas.tsx`

**Edit 1 — imports** (after the BeamState import added by WP-V2-06):

Old:

```ts
  initialBeamState,
  reduceBeam,
  type BeamState,
} from '../tools/toolGrammar';
```

New:

```ts
  initialBeamState,
  reduceBeam,
  type BeamState,
  initialCeilingState,
  reduceCeiling,
  type CeilingState,
} from '../tools/toolGrammar';
```

**Edit 2 — state refs** (after `beamStateRef`):

Old:

```ts
const beamStateRef = useRef<BeamState>(initialBeamState());
```

New:

```ts
const beamStateRef = useRef<BeamState>(initialBeamState());
const ceilingStateRef = useRef<CeilingState>(initialCeilingState());
```

**Edit 3 — tool change handler** (after beam reset, before closing `}`):

Old:

```ts
    } else if (planTool === 'beam') {
      beamStateRef.current = initialBeamState();
    }
```

New:

```ts
    } else if (planTool === 'beam') {
      beamStateRef.current = initialBeamState();
    } else if (planTool === 'ceiling') {
      ceilingStateRef.current = initialCeilingState();
    }
```

**Edit 4 — click dispatch** — add ceiling handler after beam click block. The beam block ends with:

Old:

```ts
      if (planTool === 'beam') {
        const { state, effect } = reduceBeam(beamStateRef.current, { kind: 'click', pointMm: sp });
        beamStateRef.current = state;
        if (effect.commitBeam) {
          console.warn('stub: beam placement not implemented', effect.commitBeam);
        }
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'room') {
```

New:

```ts
      if (planTool === 'beam') {
        const { state, effect } = reduceBeam(beamStateRef.current, { kind: 'click', pointMm: sp });
        beamStateRef.current = state;
        if (effect.commitBeam) {
          console.warn('stub: beam placement not implemented', effect.commitBeam);
        }
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'ceiling') {
        const rect = rnd.domElement.getBoundingClientRect();
        const worldPerPxMm = (2 * camRef.current.half * 1000) / Math.max(1, rect.width);
        const threshMm = 12 * worldPerPxMm;
        const fst = ceilingStateRef.current.phase === 'sketch'
          ? ceilingStateRef.current.verticesMm[0]
          : undefined;
        if (
          fst &&
          (ceilingStateRef.current as { verticesMm: unknown[] }).verticesMm.length >= 3 &&
          Math.hypot(sp.xMm - fst.xMm, sp.yMm - fst.yMm) <= threshMm
        ) {
          const { effect } = reduceCeiling(ceilingStateRef.current, { kind: 'close-loop' });
          ceilingStateRef.current = initialCeilingState();
          if (effect.commitCeiling) {
            console.warn('stub: ceiling command not implemented', effect.commitCeiling);
          }
        } else {
          const { state } = reduceCeiling(ceilingStateRef.current, { kind: 'click', pointMm: sp });
          ceilingStateRef.current = state;
        }
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'room') {
```

**Edit 5 — escape handler** (after beam escape):

Old:

```ts
        } else if (planTool === 'beam') {
          beamStateRef.current = initialBeamState();
        }
```

New:

```ts
        } else if (planTool === 'beam') {
          beamStateRef.current = initialBeamState();
        } else if (planTool === 'ceiling') {
          ceilingStateRef.current = initialCeilingState();
        }
```

---

### 6. `packages/ui/src/icons.tsx`

**Edit 1 — imports from @bim-ai/icons** (add `CeilingIcon` alongside ColumnIcon + BeamIcon):

Old:

```ts
  ColumnIcon,
  BeamIcon,
```

New:

```ts
  ColumnIcon,
  BeamIcon,
  CeilingIcon,
```

**Edit 2 — Icons map** (add after beam entry):

Old:

```ts
  column: ColumnIcon,
  beam: BeamIcon,
```

New:

```ts
  column: ColumnIcon,
  beam: BeamIcon,
  ceiling: CeilingIcon,
```

**Edit 3 — IconLabels map** (add after beam entry):

Old:

```ts
  column: 'Column',
  beam: 'Beam',
```

New:

```ts
  column: 'Column',
  beam: 'Beam',
  ceiling: 'Ceiling',
```

**Edit 4 — re-export** (add `CeilingIcon` to the bottom re-exports):

Old:

```ts
  ColumnIcon,
  BeamIcon,
```

New:

```ts
  ColumnIcon,
  BeamIcon,
  CeilingIcon,
```

---

### 7. `packages/web/src/plan/symbology.ts`

Add a ceiling outline loop after the roof loop (line 901) and before the walls loop.

**Old** (after roof loop ending at line 901):

```ts
  }

  for (const wall of walls) holder.add(planWallMesh(wall, opts.selectedId, lineWeightScale));
```

**New:**

```ts
  }

  for (const cl of Object.values(elementsById)) {
    if (cl.kind !== 'ceiling') continue;
    if (kindHidden('ceiling' as Parameters<typeof kindHidden>[0])) continue;

    if (level && cl.levelId !== level) continue;

    holder.add(
      horizontalOutlineMesh(
        cl.boundaryMm,
        PLAN_Y + 0.003,
        getPlanPalette().floorOutline,
        0.14,
        cl.id,
      ),
    );
  }

  for (const wall of walls) holder.add(planWallMesh(wall, opts.selectedId, lineWeightScale));
```

Note: `kindHidden` may be typed to only accept known category keys. If the TypeScript cast causes
an error, replace with a simple `if (false) continue;` stub until the full category system is
extended. The loop itself is correct — the type guard just needs to compile.

---

### 8. `packages/web/src/viewport/meshBuilders.ts`

**Append to end of file** (after line 1573 + any column/beam additions from WP-V2-06):

```ts
export function makeCeilingMesh(
  ceiling: Extract<Element, { kind: 'ceiling' }>,
  elementsById: Record<string, Element>,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const elev = elevationMForLevel(ceiling.levelId, elementsById);
  const heightOff = (ceiling.heightOffsetMm ?? 0) / 1000;
  const th = THREE.MathUtils.clamp((ceiling.thicknessMm ?? 50) / 1000, 0.02, 0.5);
  const boundary = ceiling.boundaryMm ?? [];

  const shape = new THREE.Shape(
    boundary.length >= 3
      ? boundary.map((p) => new THREE.Vector2(p.xMm / 1000, -p.yMm / 1000))
      : [
          new THREE.Vector2(0, 0),
          new THREE.Vector2(6, 0),
          new THREE.Vector2(6, -6),
          new THREE.Vector2(0, -6),
        ],
  );

  const geom = new THREE.ExtrudeGeometry(shape, { depth: th, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);

  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      color: categoryColorOr(paint, 'floor'),
      roughness: paint?.categories.floor.roughness ?? 0.9,
      transparent: true,
      opacity: 0.7,
    }),
  );
  mesh.position.set(0, elev + heightOff, 0);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.userData.bimPickId = ceiling.id;
  addEdges(mesh, 20);
  return mesh;
}
```

---

### 9. `packages/web/src/Viewport.tsx`

**Edit 1 — imports** (add `makeCeilingMesh` alongside the other mesh builders):

Old:

```ts
  makeColumnMesh,
  makeBeamMesh,
} from './viewport/meshBuilders';
```

New:

```ts
  makeColumnMesh,
  makeBeamMesh,
  makeCeilingMesh,
} from './viewport/meshBuilders';
```

**Edit 2 — switch cases** (add ceiling before the column case):

Old:

```ts
        case 'column': {
          const elev = elevationMForLevel(e.levelId, curr);
          obj = makeColumnMesh(e, elev, paint);
          break;
        }
```

New:

```ts
        case 'ceiling':
          obj = makeCeilingMesh(e, curr, paint);
          break;
        case 'column': {
          const elev = elevationMForLevel(e.levelId, curr);
          obj = makeColumnMesh(e, elev, paint);
          break;
        }
```

---

### 10. `packages/web/src/i18n.ts`

**English — add ceiling tool label** (after beam labels):

Old:

```ts
          beam: {
            label: 'Beam',
            tooltip: 'Two-click structural beam (BM)',
          },
          disabled: {
```

New:

```ts
          beam: {
            label: 'Beam',
            tooltip: 'Two-click structural beam (BM)',
          },
          ceiling: {
            label: 'Ceiling',
            tooltip: 'Sketch ceiling boundary polygon (CL)',
          },
          disabled: {
```

**German — add ceiling tool label** (after beam labels):

Old:

```ts
          beam: {
            label: 'Träger',
            tooltip: 'Zwei Klicks für einen Träger (BM)',
          },
          disabled: {
```

New:

```ts
          beam: {
            label: 'Träger',
            tooltip: 'Zwei Klicks für einen Träger (BM)',
          },
          ceiling: {
            label: 'Decke',
            tooltip: 'Deckenumriss skizzieren (CL)',
          },
          disabled: {
```

---

## Tests to run

```bash
pnpm --filter web exec vitest run src/tools/toolGrammar.test.ts
pnpm --filter web typecheck
```

---

## New test coverage to add (append to `src/tools/toolGrammar.test.ts`)

Add the following imports at the top alongside the existing ones:

Old:

```ts
  initialBeamState,
  reduceBeam,
```

New:

```ts
  initialBeamState,
  reduceBeam,
  initialCeilingState,
  reduceCeiling,
```

Append at end of file:

```ts
describe('Ceiling reducer', () => {
  it('transitions to sketch on first click', () => {
    const s0 = initialCeilingState();
    const { state } = reduceCeiling(s0, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } });
    expect(state.phase).toBe('sketch');
  });
  it('accumulates vertices', () => {
    let state = initialCeilingState();
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 1000, yMm: 0 } }).state;
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 1000, yMm: 1000 } }).state;
    expect((state as { verticesMm: unknown[] }).verticesMm).toHaveLength(3);
  });
  it('emits commitCeiling with ≥3 vertices on close-loop', () => {
    let state = initialCeilingState();
    const pts = [
      { xMm: 0, yMm: 0 },
      { xMm: 1000, yMm: 0 },
      { xMm: 1000, yMm: 1000 },
    ];
    for (const p of pts) state = reduceCeiling(state, { kind: 'click', pointMm: p }).state;
    const { effect } = reduceCeiling(state, { kind: 'close-loop' });
    expect(effect.commitCeiling?.verticesMm).toHaveLength(3);
    expect(effect.stillActive).toBe(true);
  });
  it('does not commit with fewer than 3 vertices', () => {
    let state = initialCeilingState();
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { effect } = reduceCeiling(state, { kind: 'close-loop' });
    expect(effect.commitCeiling).toBeUndefined();
  });
  it('cancel resets to idle', () => {
    let state = initialCeilingState();
    state = reduceCeiling(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { state: next } = reduceCeiling(state, { kind: 'cancel' });
    expect(next.phase).toBe('idle');
  });
});
```

---

## Commit format

```bash
git add packages/core/src/index.ts \
        packages/web/src/tools/toolRegistry.ts \
        packages/web/src/state/storeTypes.ts \
        packages/web/src/tools/toolGrammar.ts \
        packages/web/src/tools/toolGrammar.test.ts \
        packages/web/src/plan/PlanCanvas.tsx \
        packages/ui/src/icons.tsx \
        packages/web/src/plan/symbology.ts \
        packages/web/src/viewport/meshBuilders.ts \
        packages/web/src/Viewport.tsx \
        packages/web/src/i18n.ts
git commit -m "$(cat <<'EOF'
feat(ceiling): WP-V2-08 — ceiling element type, sketch tool, plan outline + 3D slab

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push -u origin feat/wp-v2-08-ceilings
```
