# Wave 29 — WP-B: 2D Detail View Subtype (§6.4.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§6.4.2 "Detailansicht" is Partial P2. bim-ai has `detail_line`, `detail_region`, `detail_component` element types and `detailComponentsRender.ts` renders them into a plan view. What's missing is a dedicated "Detail View" (Drafting View in Revit) — a plan view subtype that contains ONLY 2D detail drafting elements (no 3D model geometry), used for isolated construction details.

This task adds:

1. `planViewSubtype: 'drafting'` value (detail views use `planViewSubtype: 'drafting'`)
2. `CreateDraftingViewCmd` command type
3. Workspace handler that creates a `plan_view` with `planViewSubtype: 'drafting'`
4. In `rebuildPlanMeshes()` (symbology.ts), skip 3D model elements when view is `planViewSubtype: 'drafting'`
5. ProjectBrowser: "Drafting Views" subtree with "New Drafting View" button
6. `annotate.create-drafting-view` capability
7. Tests

---

## Repo orientation

```
packages/core/src/index.ts                              — find plan_view type, planViewSubtype field
packages/web/src/plan/symbology.ts                      — find rebuildPlanMeshes, where 3D elements are built
packages/web/src/workspace/Workspace.tsx                — find plan_view creation handlers
packages/web/src/workspace/project/ProjectBrowser.tsx   — find browser sections, "New" buttons
```

Run before editing:

- `grep -n "planViewSubtype\|callout\|drafting\|detail.*view" packages/core/src/index.ts | head -15`
- `grep -n "planViewSubtype\|callout\|drafting" packages/web/src/plan/symbology.ts | head -10`
- `grep -n "planViewSubtype\|createPlanView\|addPlanView" packages/web/src/workspace/Workspace.tsx | head -15`
- `grep -n "Drafting\|drafting\|callout.*section\|detail.*view\|browser.*section" packages/web/src/workspace/project/ProjectBrowser.tsx | head -15`

Read `plan_view` type in `packages/core/src/index.ts` to see what values `planViewSubtype` already accepts. Read `rebuildPlanMeshes()` in `symbology.ts` to understand how to conditionally skip elements.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add 'drafting' to planViewSubtype in core

Find the `plan_view` element type in `packages/core/src/index.ts`. Find the `planViewSubtype` field. Add `'drafting'` as a valid value:

```ts
planViewSubtype?: 'callout' | 'reflected-ceiling' | 'area' | 'drafting';
```

**Important**: Read the actual `planViewSubtype` definition. Add `'drafting'` to the existing union without removing other values.

### B — Add CreateDraftingViewCmd

Find where other `Cmd` types are defined. Add:

```ts
export type CreateDraftingViewCmd = {
  type: 'createDraftingView';
  /** Human-readable name for the drafting view. */
  name: string;
};
```

Add `| CreateDraftingViewCmd` to `SemanticCommand` and export it.

### C — Workspace handler

Find where `plan_view` elements are created. Add:

```ts
if (cmd.type === 'createDraftingView') {
  const id = `pv-drafting-${Date.now()}`;
  useBimStore.setState((s) => ({
    elementsById: {
      ...s.elementsById,
      [id]: {
        kind: 'plan_view' as const,
        id,
        name: (cmd.name as string) || 'Drafting View',
        planViewSubtype: 'drafting' as const,
        levelId: null,
        cropRegionEnabled: false,
      },
    },
  }));
  return;
}
```

**Important**: Read the actual `plan_view` element shape. Match the required fields exactly.

### D — symbology.ts: skip 3D elements in drafting views

In `rebuildPlanMeshes()` (or wherever plan elements are built), find the entry point where the active view is checked. Add an early-out for `planViewSubtype: 'drafting'` that skips wall/floor/room/column/stair/beam/roof meshes:

```ts
// §6.4.2: drafting views show only 2D detail components, not 3D model geometry
const activePlanView = opts.activeViewId ? elementsById[opts.activeViewId] : undefined;
const isDraftingView = (activePlanView as any)?.planViewSubtype === 'drafting';

// Inside the element loop, wrap 3D model elements:
if (
  isDraftingView &&
  (el.kind === 'wall' ||
    el.kind === 'floor' ||
    el.kind === 'room' ||
    el.kind === 'column' ||
    el.kind === 'stair' ||
    el.kind === 'beam' ||
    el.kind === 'roof')
) {
  continue; // skip 3D model geometry in drafting views
}
```

**Important**: Read the actual `rebuildPlanMeshes` loop structure carefully. Find the right place to insert the drafting view skip. The loop may be complex — adapt to the actual code.

### E — ProjectBrowser: Drafting Views subtree

In `ProjectBrowser.tsx`, find where section groups like "Floor Plans", "Sheets", "Sections" are listed. Add a "Drafting Views" section:

```tsx
{
  /* §6.4.2: Drafting Views section */
}
{
  draftingViews.length > 0 && (
    <PbCollapsibleSection label="Drafting Views" data-testid="browser-drafting-views-section">
      {draftingViews.map((pv) => (
        <div
          key={pv.id}
          data-testid={`browser-drafting-view-${pv.id}`}
          style={{ ...rowStyle, paddingLeft: 24 }}
          onClick={() => onOpenView?.(pv.id)}
        >
          {(pv as any).name ?? pv.id}
        </div>
      ))}
    </PbCollapsibleSection>
  );
}
```

Where `draftingViews = Object.values(elementsById).filter(e => e.kind === 'plan_view' && (e as any).planViewSubtype === 'drafting')`.

Also add a "New Drafting View" button somewhere accessible (e.g. in the project tree or a "+" button):

```tsx
<button
  data-testid="browser-new-drafting-view-btn"
  onClick={() =>
    onSemanticCommand?.({ type: 'createDraftingView', name: `Detail ${draftingViews.length + 1}` })
  }
  style={{ fontSize: 10, padding: '2px 6px', marginLeft: 4 }}
>
  + Draft
</button>
```

**Important**: Read the actual ProjectBrowser.tsx structure. Find where other view sections are defined and the `PbCollapsibleSection` (or equivalent) usage. Adapt to the actual component structure.

### F — commandCapabilities.ts entry

```ts
{
  id: 'annotate.create-drafting-view',
  label: 'Create Drafting View',
  owner: 'workspace/project/ProjectBrowser',
  group: 'annotate',
  scope: 'global',
  intendedModes: ['plan'],
  surfaces: ['project-browser', 'cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§6.4.2: creates plan_view with planViewSubtype=drafting; drafting views show only 2D detail_line/detail_region/detail_component elements (3D model geometry hidden).',
},
```

Add a matching `registerCommand` for `annotate.create-drafting-view` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'annotate.create-drafting-view',
  label: 'Create Drafting View',
  keywords: ['drafting', 'detail view', 'detail drawing', '2D view', 'isolation'],
  category: 'annotate',
  isAvailable: () => true,
  invoke: (ctx) => {
    ctx.dispatchCommand?.({ type: 'createDraftingView', name: 'Drafting View' });
  },
});
```

### G — Tests

Create `packages/web/src/plan/draftingView.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Drafting view — §6.4.2', () => {
  it('CreateDraftingViewCmd has correct shape', () => {
    const cmd = { type: 'createDraftingView' as const, name: 'Detail 1' };
    expect(cmd.type).toBe('createDraftingView');
    expect(cmd.name).toBe('Detail 1');
  });

  it('drafting view has planViewSubtype drafting', () => {
    const view: any = { kind: 'plan_view', id: 'pv1', planViewSubtype: 'drafting', levelId: null };
    expect(view.planViewSubtype).toBe('drafting');
  });

  it('isDraftingView returns true for drafting subtype', () => {
    const view: any = { planViewSubtype: 'drafting' };
    const isDraftingView = view?.planViewSubtype === 'drafting';
    expect(isDraftingView).toBe(true);
  });

  it('isDraftingView returns false for regular plan view', () => {
    const view: any = { planViewSubtype: undefined };
    const isDraftingView = view?.planViewSubtype === 'drafting';
    expect(isDraftingView).toBe(false);
  });

  it('wall element should be skipped in drafting view', () => {
    const el: any = { kind: 'wall' };
    const isDraftingView = true;
    const skipInDrafting = isDraftingView && ['wall', 'floor', 'room', 'column'].includes(el.kind);
    expect(skipInDrafting).toBe(true);
  });

  it('detail_line should NOT be skipped in drafting view', () => {
    const el: any = { kind: 'detail_line' };
    const isDraftingView = true;
    const skipInDrafting = isDraftingView && ['wall', 'floor', 'room', 'column'].includes(el.kind);
    expect(skipInDrafting).toBe(false);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave29/B): 2D drafting view subtype — planViewSubtype=drafting + CreateDraftingViewCmd + Workspace handler + symbology skip 3D elements + ProjectBrowser section (§6.4.2)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
