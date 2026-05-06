# WP-V2-04 — Wall Opening + Shaft Opening Tools

**Branch:** `feat/wp-v2-04-openings`
**Wave:** 2, Batch B (parallel with WP-V2-03b; start after Batch A is merged to main)
**Tracker:** Update `spec/workpackage-master-tracker.md` WP-V2-04 → `done` when merged.

---

## Branch setup (run first)

```bash
git checkout main && git pull && git checkout -b feat/wp-v2-04-openings
git branch --show-current   # must print: feat/wp-v2-04-openings
```

---

## Pre-existing test failures (ignore — do not investigate)

- `src/workspace/VVDialog.test.tsx` — VVDialog is committed in Batch A; these may still fail if 03a isn't merged yet.
- `src/workspace/RedesignedWorkspace.semanticCommand.test.tsx` — flaky URL mock issue unrelated to this WP.

---

## Context

R2-01 (CSG wall cuts) is already done — `packages/web/src/viewport/csgWorker.ts` uses `three-bvh-csg`. This WP adds only the authoring tools.

`wall-join` was added in WP-V2-02 and is already in the codebase. Follow the exact same pattern.

---

## Files to touch

| File | Change |
|---|---|
| `packages/web/src/tools/toolRegistry.ts` | Add `wall-opening`, `shaft` to ToolId + registry + palette |
| `packages/web/src/tools/toolGrammar.ts` | Add `WallOpeningState`, `ShaftState`, reducers |
| `packages/web/src/state/storeTypes.ts` | Add `wall-opening`, `shaft` to `PlanTool` union |
| `packages/web/src/plan/PlanCanvas.tsx` | Dispatch tool events, sketch preview meshes |
| `packages/ui/src/icons.tsx` | Add icon map entries |
| `packages/web/src/tools/toolGrammar.test.ts` | Add reducer tests |

---

## Changes

Read all 6 files in a single parallel batch before making any edits.

### 1. `packages/web/src/tools/toolRegistry.ts`

**ToolId union** — current end of union (line 38–39):
```ts
  | 'trim'
  | 'wall-join';
```
Replace with:
```ts
  | 'trim'
  | 'wall-join'
  | 'wall-opening'
  | 'shaft';
```

**getToolRegistry** — current end of function (line 188–189), the closing `};` after `wall-join`:
```ts
    'wall-join': {
      id: 'wall-join',
      label: t('tools.wallJoin.label'),
      icon: 'wall-join',
      hotkey: 'WJ',
      modes: ['plan'],
      tooltip: t('tools.wallJoin.tooltip'),
    },
  };
}
```
Replace with:
```ts
    'wall-join': {
      id: 'wall-join',
      label: t('tools.wallJoin.label'),
      icon: 'wall-join',
      hotkey: 'WJ',
      modes: ['plan'],
      tooltip: t('tools.wallJoin.tooltip'),
    },
    'wall-opening': {
      id: 'wall-opening',
      label: t('tools.wallOpening.label'),
      icon: 'wall-opening',
      hotkey: 'WO',
      modes: ['plan'],
      tooltip: t('tools.wallOpening.tooltip'),
    },
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

**PALETTE_ORDER** — current end (line 206–208):
```ts
  'trim',
  'wall-join',
];
```
Replace with:
```ts
  'trim',
  'wall-join',
  'wall-opening',
  'shaft',
];
```

### 2. `packages/web/src/state/storeTypes.ts`

**PlanTool union** — current end (line 40–41):
```ts
  | 'trim'
  | 'wall-join';
```
Replace with:
```ts
  | 'trim'
  | 'wall-join'
  | 'wall-opening'
  | 'shaft';
```

### 3. `packages/ui/src/icons.tsx`

The existing icon map uses lucide imports. `SquareDashed` and `Layers` are available from lucide-react.

**Add imports** — current import line (near line 23, `import { ... } from 'lucide-react'`). Find the lucide destructure block and add `Layers, SquareDashed` to it. The block currently ends near:
```ts
  Scissors,
```
(There are many imports — just append `Layers, SquareDashed,` to the existing `lucide-react` import.)

**Add icon map entries** — current entries near line 112:
```ts
  'wall-join': GitMerge,
```
Replace with:
```ts
  'wall-join': GitMerge,
  'wall-opening': SquareDashed,
  shaft: Layers,
```

**Add tooltip entries** — current entries near line 203:
```ts
  'wall-join': 'Wall Join',
```
Replace with:
```ts
  'wall-join': 'Wall Join',
  'wall-opening': 'Wall Opening',
  shaft: 'Shaft',
```

### 4. `packages/web/src/tools/toolGrammar.ts`

Append the following to the **end of the file** (after `reduceWallJoin`):

```ts
/* ────────────────────────────────────────────────────────────────────── */
/* Wall Opening — §16 Openings                                            */
/* ────────────────────────────────────────────────────────────────────── */

export interface WallOpeningState {
  phase: 'pick-wall' | 'define-rect';
  hostWallId: string | null;
  anchorMm: { xMm: number; yMm: number } | null;
}

export type WallOpeningEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click-wall'; wallId: string; pointMm: { xMm: number; yMm: number } }
  | { kind: 'drag-end'; cornerMm: { xMm: number; yMm: number } }
  | { kind: 'cancel' };

export interface WallOpeningEffect {
  commitWallOpening?: {
    hostWallId: string;
    anchorMm: { xMm: number; yMm: number };
    cornerMm: { xMm: number; yMm: number };
  };
  stillActive: boolean;
}

export function initialWallOpeningState(): WallOpeningState {
  return { phase: 'pick-wall', hostWallId: null, anchorMm: null };
}

export function reduceWallOpening(
  state: WallOpeningState,
  event: WallOpeningEvent,
): { state: WallOpeningState; effect: WallOpeningEffect } {
  if (event.kind === 'activate') {
    return { state: initialWallOpeningState(), effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: initialWallOpeningState(), effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: initialWallOpeningState(), effect: { stillActive: true } };
  }
  if (event.kind === 'click-wall' && state.phase === 'pick-wall') {
    return {
      state: { phase: 'define-rect', hostWallId: event.wallId, anchorMm: event.pointMm },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'drag-end' && state.phase === 'define-rect' && state.hostWallId && state.anchorMm) {
    return {
      state: initialWallOpeningState(),
      effect: {
        commitWallOpening: {
          hostWallId: state.hostWallId,
          anchorMm: state.anchorMm,
          cornerMm: event.cornerMm,
        },
        stillActive: true,
      },
    };
  }
  return { state, effect: { stillActive: true } };
}

/* ────────────────────────────────────────────────────────────────────── */
/* Shaft — §16 Openings                                                   */
/* ────────────────────────────────────────────────────────────────────── */

export interface ShaftState {
  phase: 'idle' | 'sketch';
  verticesMm: Array<{ xMm: number; yMm: number }>;
}

export type ShaftEvent =
  | { kind: 'activate' }
  | { kind: 'deactivate' }
  | { kind: 'click'; pointMm: { xMm: number; yMm: number } }
  | { kind: 'close-loop' }
  | { kind: 'cancel' };

export interface ShaftEffect {
  commitShaft?: { verticesMm: Array<{ xMm: number; yMm: number }> };
  stillActive: boolean;
}

export function initialShaftState(): ShaftState {
  return { phase: 'idle', verticesMm: [] };
}

export function reduceShaft(
  state: ShaftState,
  event: ShaftEvent,
): { state: ShaftState; effect: ShaftEffect } {
  if (event.kind === 'activate') {
    return { state: initialShaftState(), effect: { stillActive: true } };
  }
  if (event.kind === 'deactivate') {
    return { state: initialShaftState(), effect: { stillActive: false } };
  }
  if (event.kind === 'cancel') {
    return { state: initialShaftState(), effect: { stillActive: true } };
  }
  if (event.kind === 'click') {
    return {
      state: { phase: 'sketch', verticesMm: [...state.verticesMm, event.pointMm] },
      effect: { stillActive: true },
    };
  }
  if (event.kind === 'close-loop' && state.verticesMm.length >= 3) {
    return {
      state: initialShaftState(),
      effect: { commitShaft: { verticesMm: state.verticesMm }, stillActive: true },
    };
  }
  return { state, effect: { stillActive: true } };
}
```

### 5. `packages/web/src/plan/PlanCanvas.tsx`

**Add imports** — find the existing import block at the top of the file:
```ts
  initialWallJoinState,
  reduceAlign,
  reduceSplit,
  reduceTrim,
  reduceWallJoin,
  type AlignState,
  type SplitState,
  type TrimState,
  type WallJoinState,
} from '../tools/toolGrammar';
```
Replace with:
```ts
  initialWallJoinState,
  initialWallOpeningState,
  initialShaftState,
  reduceAlign,
  reduceSplit,
  reduceTrim,
  reduceWallJoin,
  reduceWallOpening,
  reduceShaft,
  type AlignState,
  type SplitState,
  type TrimState,
  type WallJoinState,
  type WallOpeningState,
  type ShaftState,
} from '../tools/toolGrammar';
```

**Add state refs** — find the existing ref declarations (around line 175):
```ts
  const wallJoinStateRef = useRef<WallJoinState>(initialWallJoinState());
```
Replace with:
```ts
  const wallJoinStateRef = useRef<WallJoinState>(initialWallJoinState());
  const wallOpeningStateRef = useRef<WallOpeningState>(initialWallOpeningState());
  const wallOpeningAnchorRef = useRef<{ xMm: number; yMm: number } | null>(null);
  const shaftStateRef = useRef<ShaftState>(initialShaftState());
```

**Add to tool activation effect** — find:
```ts
    } else if (planTool === 'wall-join') {
      const { state } = reduceWallJoin(wallJoinStateRef.current, { kind: 'activate' });
      wallJoinStateRef.current = state;
    }
  }, [planTool]);
```
Replace with:
```ts
    } else if (planTool === 'wall-join') {
      const { state } = reduceWallJoin(wallJoinStateRef.current, { kind: 'activate' });
      wallJoinStateRef.current = state;
    } else if (planTool === 'wall-opening') {
      wallOpeningStateRef.current = initialWallOpeningState();
    } else if (planTool === 'shaft') {
      shaftStateRef.current = initialShaftState();
    }
  }, [planTool]);
```

**Add to onClick handler** — find the end of the wall-join click handler block:
```ts
        return;
      }
      if (planTool === 'room') {
```
Replace with:
```ts
        return;
      }
      if (planTool === 'wall-opening') {
        if (wallOpeningStateRef.current.phase === 'pick-wall') {
          // Find nearest wall
          const rect = rnd.domElement.getBoundingClientRect();
          const worldPerPxMm = (2 * camRef.current.half * 1000) / Math.max(1, rect.width);
          const threshMm = 12 * worldPerPxMm;
          let bestWall: string | null = null;
          let bestDist = Infinity;
          for (const el of Object.values(elementsById)) {
            if (el.kind !== 'wall') continue;
            const mx = (el.start.xMm + el.end.xMm) / 2;
            const mz = (el.start.yMm + el.end.yMm) / 2;
            const d = Math.hypot(sp.xMm - mx, sp.yMm - mz);
            if (d < bestDist) { bestDist = d; bestWall = el.id; }
          }
          if (bestWall && bestDist <= threshMm * 8) {
            const { state } = reduceWallOpening(wallOpeningStateRef.current, {
              kind: 'click-wall', wallId: bestWall, pointMm: sp,
            });
            wallOpeningStateRef.current = state;
            wallOpeningAnchorRef.current = sp;
          }
        }
        return;
      }
      if (planTool === 'shaft') {
        const fst = shaftStateRef.current.verticesMm[0];
        const rect2 = rnd.domElement.getBoundingClientRect();
        const worldPerPxMm2 = (2 * camRef.current.half * 1000) / Math.max(1, rect2.width);
        const threshMm2 = 12 * worldPerPxMm2;
        if (fst && shaftStateRef.current.verticesMm.length >= 3 && Math.hypot(sp.xMm - fst.xMm, sp.yMm - fst.yMm) <= threshMm2) {
          const { effect } = reduceShaft(shaftStateRef.current, { kind: 'close-loop' });
          shaftStateRef.current = initialShaftState();
          if (effect.commitShaft) {
            console.warn('stub: shaft command not implemented', effect.commitShaft);
          }
        } else {
          const { state } = reduceShaft(shaftStateRef.current, { kind: 'click', pointMm: sp });
          shaftStateRef.current = state;
        }
        bumpGeom((x) => x + 1);
        return;
      }
      if (planTool === 'room') {
```

**Add to pointer-up handler for wall-opening drag-end** — find the pointer-up section. After the marquee selection code, add a case for wall-opening drag completion. Find:
```ts
    const onPointerUp = (ev: PointerEvent) => {
```
Read the onPointerUp handler to understand the structure, then add after the marquee block:
```ts
      if (planTool === 'wall-opening' && wallOpeningStateRef.current.phase === 'define-rect' && wallOpeningAnchorRef.current) {
        const { effect } = reduceWallOpening(wallOpeningStateRef.current, {
          kind: 'drag-end', cornerMm: sp,
        });
        wallOpeningStateRef.current = initialWallOpeningState();
        wallOpeningAnchorRef.current = null;
        if (effect.commitWallOpening) {
          console.warn('stub: wall-opening command not implemented', effect.commitWallOpening);
        }
      }
```

**Add Escape key handling** — find the existing cancel block:
```ts
        } else if (planTool === 'wall-join') {
          const { state } = reduceWallJoin(wallJoinStateRef.current, { kind: 'cancel' });
          wallJoinStateRef.current = state;
        }
```
Replace with:
```ts
        } else if (planTool === 'wall-join') {
          const { state } = reduceWallJoin(wallJoinStateRef.current, { kind: 'cancel' });
          wallJoinStateRef.current = state;
        } else if (planTool === 'wall-opening') {
          wallOpeningStateRef.current = initialWallOpeningState();
          wallOpeningAnchorRef.current = null;
        } else if (planTool === 'shaft') {
          shaftStateRef.current = initialShaftState();
        }
```

---

## New test cases in `packages/web/src/tools/toolGrammar.test.ts`

Add at the end of the file:

```ts
describe('WallOpening reducer', () => {
  it('transitions pick-wall → define-rect on click-wall', () => {
    const s0 = initialWallOpeningState();
    const { state } = reduceWallOpening(s0, { kind: 'click-wall', wallId: 'w1', pointMm: { xMm: 100, yMm: 200 } });
    expect(state.phase).toBe('define-rect');
    expect(state.hostWallId).toBe('w1');
    expect(state.anchorMm).toEqual({ xMm: 100, yMm: 200 });
  });
  it('emits commitWallOpening on drag-end and returns to pick-wall', () => {
    let state = initialWallOpeningState();
    state = reduceWallOpening(state, { kind: 'click-wall', wallId: 'w1', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { state: next, effect } = reduceWallOpening(state, { kind: 'drag-end', cornerMm: { xMm: 500, yMm: 500 } });
    expect(effect.commitWallOpening).toEqual({ hostWallId: 'w1', anchorMm: { xMm: 0, yMm: 0 }, cornerMm: { xMm: 500, yMm: 500 } });
    expect(next.phase).toBe('pick-wall');
    expect(effect.stillActive).toBe(true);
  });
  it('resets to pick-wall on cancel', () => {
    let state = initialWallOpeningState();
    state = reduceWallOpening(state, { kind: 'click-wall', wallId: 'w1', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { state: next } = reduceWallOpening(state, { kind: 'cancel' });
    expect(next.phase).toBe('pick-wall');
  });
});

describe('Shaft reducer', () => {
  it('transitions to sketch on first click', () => {
    const s0 = initialShaftState();
    const { state } = reduceShaft(s0, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } });
    expect(state.phase).toBe('sketch');
    expect(state.verticesMm).toHaveLength(1);
  });
  it('accumulates vertices on subsequent clicks', () => {
    let state = initialShaftState();
    state = reduceShaft(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    state = reduceShaft(state, { kind: 'click', pointMm: { xMm: 1000, yMm: 0 } }).state;
    state = reduceShaft(state, { kind: 'click', pointMm: { xMm: 1000, yMm: 1000 } }).state;
    expect(state.verticesMm).toHaveLength(3);
  });
  it('emits commitShaft with ≥3 vertices on close-loop', () => {
    let state = initialShaftState();
    const pts = [{ xMm: 0, yMm: 0 }, { xMm: 1000, yMm: 0 }, { xMm: 1000, yMm: 1000 }];
    for (const p of pts) state = reduceShaft(state, { kind: 'click', pointMm: p }).state;
    const { effect } = reduceShaft(state, { kind: 'close-loop' });
    expect(effect.commitShaft?.verticesMm).toHaveLength(3);
    expect(effect.stillActive).toBe(true);
  });
  it('does not emit on close-loop with fewer than 3 vertices', () => {
    let state = initialShaftState();
    state = reduceShaft(state, { kind: 'click', pointMm: { xMm: 0, yMm: 0 } }).state;
    const { effect } = reduceShaft(state, { kind: 'close-loop' });
    expect(effect.commitShaft).toBeUndefined();
  });
});
```

---

## Tests to run

```bash
pnpm --filter web exec vitest run src/tools/toolGrammar.test.ts src/tools/ToolPalette.test.tsx
```

All tests must pass. The ToolPalette test snapshot will need updating because new tools are added — run with `--update-snapshots` if it fails on snapshot comparison only.

## Typecheck

```bash
pnpm --filter web typecheck
```

---

## Commit format

```bash
git add packages/web/src/tools/toolRegistry.ts \
        packages/web/src/tools/toolGrammar.ts \
        packages/web/src/state/storeTypes.ts \
        packages/web/src/plan/PlanCanvas.tsx \
        packages/ui/src/icons.tsx \
        packages/web/src/tools/toolGrammar.test.ts
git commit -m "$(cat <<'EOF'
feat(tools): WP-V2-04 — Wall Opening + Shaft tools

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
EOF
)"
git push -u origin feat/wp-v2-04-openings
```
