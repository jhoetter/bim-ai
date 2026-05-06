# WP-V2-06 — Structural Elements (Column + Beam)

**Branch:** `feat/wp-v2-06-structural`
**Wave:** 3, Batch B (start after WP-V2-07 merged to main)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-06 → `done` when merged.

---

## Branch setup (run first)

```bash
git checkout main && git pull && git checkout -b feat/wp-v2-06-structural
git branch --show-current   # must print: feat/wp-v2-06-structural
```

---

## Pre-existing test failures (ignore — do not investigate)

- `src/workspace/RedesignedWorkspace.semanticCommand.test.tsx` — flaky URL mock issue.

---

## Context

Add structural `column` and `beam` element types end-to-end: core type definitions, tool registry,
tool grammar (pure reducers), PlanCanvas dispatch, 3D mesh builders, and Viewport scene integration.

Icons `ColumnIcon` and `BeamIcon` are **already imported** in `packages/ui/src/icons.tsx`
(lines 48–49) and already appear in `Icons` (lines 131–132) — do not re-add them.

---

## Files to touch

| File                                        | Change                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------- |
| `packages/core/src/index.ts`                | Add `'column' \| 'beam'` to `ElemKind`; add element shapes to `Element` union |
| `packages/web/src/tools/toolRegistry.ts`    | Add to `ToolId`, `getToolRegistry`, `PALETTE_ORDER`                           |
| `packages/web/src/state/storeTypes.ts`      | Add to `PlanTool`                                                             |
| `packages/web/src/tools/toolGrammar.ts`     | Append `ColumnState`/`reduceColumn` + `BeamState`/`reduceBeam`                |
| `packages/web/src/plan/PlanCanvas.tsx`      | Import + state refs + tool change + click dispatch + escape                   |
| `packages/web/src/viewport/meshBuilders.ts` | Append `makeColumnMesh` + `makeBeamMesh`                                      |
| `packages/web/src/Viewport.tsx`             | Import mesh builders + add `case 'column'` + `case 'beam'`                    |
| `packages/web/src/i18n.ts`                  | Add tool labels (EN + DE)                                                     |

Read all 8 files in a single parallel batch before making any edits.

---

## Changes

### 1. `packages/core/src/index.ts`

**Edit 1 — add to ElemKind** (line 36):

Old:

```ts
  | 'bcf'
  | 'agent_assumption'
  | 'agent_deviation'
  | 'validation_rule';
```

New:

```ts
  | 'bcf'
  | 'agent_assumption'
  | 'agent_deviation'
  | 'validation_rule'
  | 'column'
  | 'beam';
```

**Edit 2 — add element shapes to Element union** (line 500 — after the last member `validation_rule`):

Old:

```ts
  | { kind: 'validation_rule'; id: string; name: string; ruleJson: Record<string, unknown> };
```

New:

```ts
  | { kind: 'validation_rule'; id: string; name: string; ruleJson: Record<string, unknown> }
  | {
      kind: 'column';
      id: string;
      name: string;
      levelId: string;
      positionMm: XY;
      bMm: number;
      hMm: number;
      heightMm: number;
      rotationDeg?: number;
      materialKey?: string | null;
      baseConstraintOffsetMm?: number;
      topConstraintLevelId?: string | null;
      topConstraintOffsetMm?: number;
    }
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

---

### 2. `packages/web/src/tools/toolRegistry.ts`

**Edit 1 — ToolId union** (line 40–41):

Old:

```ts
  | 'wall-opening'
  | 'shaft';
```

New:

```ts
  | 'wall-opening'
  | 'shaft'
  | 'column'
  | 'beam';
```

**Edit 2 — getToolRegistry** — append column and beam entries inside the return object, right after the `shaft` entry (before the closing `};`):

Old:

```ts
    shaft: {
      id: 'shaft',
      label: t('tools.shaft.label'),
      icon: 'shaft',
      hotkey: 'SH',
      modes: ['plan'],
      tooltip: t('tools.shaft.tooltip'),
    },
  };
}
```

New:

```ts
    shaft: {
      id: 'shaft',
      label: t('tools.shaft.label'),
      icon: 'shaft',
      hotkey: 'SH',
      modes: ['plan'],
      tooltip: t('tools.shaft.tooltip'),
    },
    column: {
      id: 'column',
      label: t('tools.column.label'),
      icon: 'column',
      hotkey: 'CO',
      modes: ['plan', 'plan-3d'],
      tooltip: t('tools.column.tooltip'),
    },
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

**Edit 3 — PALETTE_ORDER** (line 227):

Old:

```ts
  'wall-opening',
  'shaft',
];
```

New:

```ts
  'wall-opening',
  'shaft',
  'column',
  'beam',
];
```

---

### 3. `packages/web/src/state/storeTypes.ts`

**Edit — PlanTool union** (line 42–43):

Old:

```ts
  | 'wall-opening'
  | 'shaft';
```

New:

```ts
  | 'wall-opening'
  | 'shaft'
  | 'column'
  | 'beam';
```

---

### 4. `packages/web/src/tools/toolGrammar.ts`

**Append to end of file** (after the closing `}` of `reduceShaft`, currently line 770):

```ts
/* ────────────────────────────────────────────────────────────────────── */
/* C16 Column — single-click placement                                      */
/* ────────────────────────────────────────────────────────────────────── */

export type ColumnState = { phase: 'idle' };

export type ColumnEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface ColumnEffect {
  commitColumn?: { positionMm: { xMm: number; yMm: number } };
  stillActive: boolean;
}

export function initialColumnState(): ColumnState {
  return { phase: 'idle' };
}

export function reduceColumn(
  state: ColumnState,
  event: ColumnEvent,
): { state: ColumnState; effect: ColumnEffect } {
  if (event.kind === 'deactivate') {
    return { state: initialColumnState(), effect: { stillActive: false } };
  }
  if (event.kind === 'activate' || event.kind === 'cancel') {
    return { state: initialColumnState(), effect: { stillActive: event.kind === 'activate' } };
  }
  if (event.kind === 'click') {
    return {
      state: initialColumnState(),
      effect: { commitColumn: { positionMm: event.pointMm }, stillActive: true },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* C17 Beam — two-click line placement                                      */
/* ────────────────────────────────────────────────────────────────────── */

export type BeamState =
  | { phase: 'idle' }
  | { phase: 'first-point'; startMm: { xMm: number; yMm: number } };

export type BeamEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface BeamEffect {
  commitBeam?: { startMm: { xMm: number; yMm: number }; endMm: { xMm: number; yMm: number } };
  stillActive: boolean;
}

export function initialBeamState(): BeamState {
  return { phase: 'idle' };
}

export function reduceBeam(
  state: BeamState,
  event: BeamEvent,
): { state: BeamState; effect: BeamEffect } {
  if (event.kind === 'deactivate') {
    return { state: initialBeamState(), effect: { stillActive: false } };
  }
  if (event.kind === 'activate' || event.kind === 'cancel') {
    return { state: initialBeamState(), effect: { stillActive: event.kind === 'activate' } };
  }
  if (event.kind === 'click') {
    if (state.phase === 'idle') {
      return {
        state: { phase: 'first-point', startMm: event.pointMm },
        effect: { stillActive: true },
      };
    }
    if (state.phase === 'first-point') {
      return {
        state: initialBeamState(),
        effect: {
          commitBeam: { startMm: state.startMm, endMm: event.pointMm },
          stillActive: true,
        },
      };
    }
  }
  return { state, effect: { stillActive: true } };
}
```

---

### 5. `packages/web/src/plan/PlanCanvas.tsx`

**Edit 1 — imports** (line 19–21):

Old:

```ts
  type WallOpeningState,
  type ShaftState,
} from '../tools/toolGrammar';
```

New:

```ts
  type WallOpeningState,
  type ShaftState,
  initialColumnState,
  reduceColumn,
  type ColumnState,
  initialBeamState,
  reduceBeam,
  type BeamState,
} from '../tools/toolGrammar';
```

**Edit 2 — state refs** (line 184):

Old:

```ts
const shaftStateRef = useRef<ShaftState>(initialShaftState());
```

New:

```ts
const shaftStateRef = useRef<ShaftState>(initialShaftState());
const columnStateRef = useRef<ColumnState>(initialColumnState());
const beamStateRef = useRef<BeamState>(initialBeamState());
```

**Edit 3 — tool change handler** (lines 419–421):

Old:

```ts
    } else if (planTool === 'shaft') {
      shaftStateRef.current = initialShaftState();
    }
```

New:

```ts
    } else if (planTool === 'shaft') {
      shaftStateRef.current = initialShaftState();
    } else if (planTool === 'column') {
      columnStateRef.current = initialColumnState();
    } else if (planTool === 'beam') {
      beamStateRef.current = initialBeamState();
    }
```

**Edit 4 — click dispatch** — add column and beam handlers immediately after the shaft click block. The shaft block ends with:

Old:

```ts
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'room') {
```

New:

```ts
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'column') {
        const { effect } = reduceColumn(columnStateRef.current, { kind: 'click', pointMm: sp });
        columnStateRef.current = initialColumnState();
        if (effect.commitColumn) {
          console.warn('stub: column placement not implemented', effect.commitColumn);
        }
        bumpGeom((x) => x + 1);
        return;
      }
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

**Edit 5 — escape handler** (lines 1252–1253):

Old:

```ts
        } else if (planTool === 'shaft') {
          shaftStateRef.current = initialShaftState();
        }
```

New:

```ts
        } else if (planTool === 'shaft') {
          shaftStateRef.current = initialShaftState();
        } else if (planTool === 'column') {
          columnStateRef.current = initialColumnState();
        } else if (planTool === 'beam') {
          beamStateRef.current = initialBeamState();
        }
```

---

### 6. `packages/web/src/viewport/meshBuilders.ts`

**Append to end of file** (after line 1573):

```ts
export function makeColumnMesh(
  col: Extract<Element, { kind: 'column' }>,
  elevM: number,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const bM = THREE.MathUtils.clamp((col.bMm ?? 300) / 1000, 0.05, 2);
  const hM = THREE.MathUtils.clamp((col.hMm ?? 300) / 1000, 0.05, 2);
  const baseOff = (col.baseConstraintOffsetMm ?? 0) / 1000;
  const topOff = col.topConstraintOffsetMm != null ? col.topConstraintOffsetMm / 1000 : 0;
  const heightM = col.heightMm != null ? THREE.MathUtils.clamp(col.heightMm / 1000, 0.25, 40) : 3.0;
  const yBase = elevM + baseOff;
  const geo = new THREE.BoxGeometry(bM, heightM, hM);
  const mat = new THREE.MeshStandardMaterial({
    color: categoryColorOr(paint, 'wall'),
    roughness: paint?.categories.wall.roughness ?? 0.8,
    metalness: paint?.categories.wall.metalness ?? 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(
    col.positionMm.xMm / 1000,
    yBase + heightM / 2 + topOff,
    col.positionMm.yMm / 1000,
  );
  mesh.rotation.y = THREE.MathUtils.degToRad(col.rotationDeg ?? 0);
  addEdges(mesh);
  return mesh;
}

export function makeBeamMesh(
  beam: Extract<Element, { kind: 'beam' }>,
  elevM: number,
  paint: ViewportPaintBundle | null,
): THREE.Mesh {
  const sx = beam.startMm.xMm / 1000;
  const sz = beam.startMm.yMm / 1000;
  const ex = beam.endMm.xMm / 1000;
  const ez = beam.endMm.yMm / 1000;
  const dx = ex - sx;
  const dz = ez - sz;
  const len = Math.max(0.001, Math.hypot(dx, dz));
  const wM = THREE.MathUtils.clamp((beam.widthMm ?? 200) / 1000, 0.05, 1);
  const hM = THREE.MathUtils.clamp((beam.heightMm ?? 400) / 1000, 0.05, 1);
  const geo = new THREE.BoxGeometry(len, hM, wM);
  const mat = new THREE.MeshStandardMaterial({
    color: categoryColorOr(paint, 'wall'),
    roughness: paint?.categories.wall.roughness ?? 0.8,
    metalness: paint?.categories.wall.metalness ?? 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(sx + dx / 2, elevM - hM / 2, sz + dz / 2);
  mesh.rotation.y = Math.atan2(dz, dx);
  addEdges(mesh);
  return mesh;
}
```

---

### 7. `packages/web/src/Viewport.tsx`

**Edit 1 — imports** (lines 54–57):

Old:

```ts
  makeBalconyMesh,
  makeRailingMesh,
  makeSiteMesh,
} from './viewport/meshBuilders';
```

New:

```ts
  makeBalconyMesh,
  makeRailingMesh,
  makeSiteMesh,
  makeColumnMesh,
  makeBeamMesh,
} from './viewport/meshBuilders';
```

**Edit 2 — switch cases** — add column and beam before the site case (around line 1037):

Old:

```ts
        case 'site':
          obj = makeSiteMesh(e, curr, paint);
          break;
        default:
          break;
```

New:

```ts
        case 'column': {
          const elev = elevationMForLevel(e.levelId, curr);
          obj = makeColumnMesh(e, elev, paint);
          break;
        }
        case 'beam': {
          const elev = elevationMForLevel(e.levelId, curr);
          obj = makeBeamMesh(e, elev, paint);
          break;
        }
        case 'site':
          obj = makeSiteMesh(e, curr, paint);
          break;
        default:
          break;
```

---

### 8. `packages/web/src/i18n.ts`

Add tool labels for column and beam in both languages. The tools section ends at `disabled:` block.

**English — old** (in `tools:` block):

```ts
          trim: {
            label: 'Trim / Extend',
            tooltip: 'Click reference line, then segment to trim or extend (TR)',
          },
          disabled: {
```

**English — new:**

```ts
          trim: {
            label: 'Trim / Extend',
            tooltip: 'Click reference line, then segment to trim or extend (TR)',
          },
          column: {
            label: 'Column',
            tooltip: 'Click to place a structural column (CO)',
          },
          beam: {
            label: 'Beam',
            tooltip: 'Two-click structural beam (BM)',
          },
          disabled: {
```

**German — old** (in `tools:` block):

```ts
          trim: {
            label: 'Trim / Extend',
            tooltip: 'Referenzlinie anklicken, dann Segment zum Trimmen oder Verlängern (TR)',
          },
          disabled: {
```

**German — new:**

```ts
          trim: {
            label: 'Trim / Extend',
            tooltip: 'Referenzlinie anklicken, dann Segment zum Trimmen oder Verlängern (TR)',
          },
          column: {
            label: 'Stütze',
            tooltip: 'Klicken zum Platzieren einer Stütze (CO)',
          },
          beam: {
            label: 'Träger',
            tooltip: 'Zwei Klicks für einen Träger (BM)',
          },
          disabled: {
```

---

## Tests to run

```bash
pnpm --filter web exec vitest run src/tools/toolGrammar.test.ts
pnpm --filter web typecheck
```

All grammar tests must pass. Typecheck must have 0 errors.

---

## New test coverage to add (append to `src/tools/toolGrammar.test.ts`)

Append at the end of the file (after the last `});` closing brace):

```ts
describe('Column reducer', () => {
  it('emits commitColumn on click', () => {
    const s0 = initialColumnState();
    const { effect } = reduceColumn(s0, { kind: 'click', pointMm: { xMm: 1000, yMm: 2000 } });
    expect(effect.commitColumn?.positionMm).toEqual({ xMm: 1000, yMm: 2000 });
    expect(effect.stillActive).toBe(true);
  });
  it('stays idle after cancel', () => {
    const { state, effect } = reduceColumn(initialColumnState(), { kind: 'cancel' });
    expect(state.phase).toBe('idle');
    expect(effect.stillActive).toBe(false);
  });
});

describe('Beam reducer', () => {
  it('transitions to first-point on first click', () => {
    const { state } = reduceBeam(initialBeamState(), {
      kind: 'click',
      pointMm: { xMm: 0, yMm: 0 },
    });
    expect(state.phase).toBe('first-point');
  });
  it('emits commitBeam on second click', () => {
    let state = initialBeamState();
    state = reduceBeam(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { effect } = reduceBeam(state, { kind: 'click', pointMm: { xMm: 5000, yMm: 0 } });
    expect(effect.commitBeam?.startMm).toEqual({ xMm: 0, yMm: 0 });
    expect(effect.commitBeam?.endMm).toEqual({ xMm: 5000, yMm: 0 });
    expect(effect.stillActive).toBe(true);
  });
  it('resets to idle after cancel', () => {
    let state = initialBeamState();
    state = reduceBeam(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { state: next } = reduceBeam(state, { kind: 'cancel' });
    expect(next.phase).toBe('idle');
  });
});
```

The test file **already imports** `initialShaftState`, `reduceShaft` etc. at the top. Add the new imports alongside them:

Old (in the imports block at top of the file):

```ts
  initialShaftState,
  reduceShaft,
```

New:

```ts
  initialShaftState,
  reduceShaft,
  initialColumnState,
  reduceColumn,
  initialBeamState,
  reduceBeam,
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
        packages/web/src/viewport/meshBuilders.ts \
        packages/web/src/Viewport.tsx \
        packages/web/src/i18n.ts
git commit -m "$(cat <<'EOF'
feat(structural): WP-V2-06 — column + beam element types, tools, and 3D mesh builders

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push -u origin feat/wp-v2-06-structural
```
