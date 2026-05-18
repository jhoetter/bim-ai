# Wave 15 — WP-I: Linework Override Tool (§3.3.7)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/core/src/index.ts                              — plan_view element type
packages/web/src/tools/toolRegistry.ts                  — tool registration
packages/web/src/plan/toolGrammar.ts                    — tool state machines
packages/web/src/plan/PlanCanvas.tsx                    — click dispatch
packages/web/src/plan/symbology.ts                      — plan mesh builder loop
packages/web/src/cmdPalette/defaultCommands.ts          — palette commands
packages/web/src/workspace/inspector/InspectorContent.tsx — inspector panels
packages/web/src/i18n.ts                                — label strings
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. `core/index.ts`: Find `plan_view` element kind. Check if it already has `lineworkOverrides`. If not, add it:
   ```ts
   lineworkOverrides?: Array<{
     elementId: string;
     colorHex: string;        // e.g. '#ff0000'
     lineWeightPx: number;    // 0.5 | 1 | 2 | 3
     lineDash?: number[];     // e.g. [4, 4] for dashed
   }> | null;
   ```
2. `toolRegistry.ts`: Check for existing `'linework'` ToolId. Add if missing.
3. `toolGrammar.ts`: Read how the paint tool grammar works — linework override is structurally similar (pick element → apply override).

---

## Tasks

### A — Add `lineworkOverrides` to `plan_view` in `core/index.ts`

If not present, add the field as shown above.

---

### B — Tool registration

In `toolRegistry.ts` (or `defaultCommands.ts` equivalent), register:

```ts
{ id: 'linework', hotkey: 'LW', label: 'Linework Override', mode: 'plan' }
```

In `defaultCommands.ts`:

```ts
{ id: 'tool.linework', label: 'Linework Override', category: 'tool',
  invoke: (ctx) => startPlanTool(ctx, 'linework') }
```

---

### C — Grammar in `toolGrammar.ts`

Add `LineworkState` / `reduceLinework`:

```ts
// States: idle → active (tool selected, waiting for click)
// On click in 'active' state:
//   - Pick the element under the cursor.
//   - Emit { kind: 'applyLineworkOverride', elementId, colorHex, lineWeightPx, lineDash }
// colorHex and lineWeightPx are read from the options bar (passed in as grammar opts).
// Escape → idle.
```

Wire into `PlanCanvas.tsx` just as the paint tool is wired (short section — just call `reduceLinework` on click and emit the effect as a semantic command `apply_linework_override`).

---

### D — Semantic command handler in `Workspace.tsx`

Add handler for `type: 'apply_linework_override'`:

```ts
if (cmd.type === 'apply_linework_override') {
  const { elementId, colorHex, lineWeightPx, lineDash, viewId } = cmd;
  const view = useBimStore.getState().elementsById[viewId ?? activePlanViewId ?? ''];
  if (!view || view.kind !== 'plan_view') return;
  const existing = view.lineworkOverrides ?? [];
  const filtered = existing.filter((o) => o.elementId !== elementId);
  const updated = [...filtered, { elementId, colorHex, lineWeightPx, lineDash }];
  void onSemanticCommand({
    type: 'updateElementProperty',
    elementId: view.id,
    key: 'lineworkOverrides',
    value: updated,
  });
  return;
}
```

---

### E — OptionsBar for linework tool

When the `linework` tool is active, show in the OptionsBar (find `OptionsBar.tsx` and add a section):

- Color picker input: `data-testid="options-linework-color"` (default `#ff0000`)
- Line weight select: `data-testid="options-linework-weight"` — options: 0.5, 1, 2, 3
- Style select: `data-testid="options-linework-style"` — Solid, Dashed, Hidden

---

### F — Apply overrides in `symbology.ts`

In `rebuildPlanMeshes`, after building meshes for each element, apply linework overrides:

```ts
const overrides = opts.lineworkOverrides ?? [];
for (const override of overrides) {
  // Find all THREE.Line or THREE.Mesh objects with userData.bimPickId === override.elementId
  scene.traverse((obj) => {
    if (obj.userData.bimPickId !== override.elementId) return;
    if (obj instanceof THREE.Line && obj.material instanceof THREE.LineBasicMaterial) {
      obj.material.color.setStyle(override.colorHex);
      // Note: Three.js linewidth is only 1 on WebGL; use lineDash for dashed
      if (override.lineDash && obj.material instanceof THREE.LineDashedMaterial) {
        obj.material.dashSize = override.lineDash[0] ?? 4;
        obj.material.gapSize = override.lineDash[1] ?? 4;
      }
    }
  });
}
```

Pass `lineworkOverrides` from `PlanCanvas.tsx` into `rebuildPlanMeshes` opts (read from active plan view element).

---

### G — Inspector section: show/remove linework overrides

In `InspectorContent.tsx`, for `kind === 'plan_view'`, add a collapsible section:

```tsx
<CollapsibleSection title="Linework Overrides" data-testid="inspector-linework-overrides">
  {(el.lineworkOverrides ?? []).length === 0 ? (
    <p style={{ fontSize: 11, color: 'var(--color-muted)' }}>
      None. Use the Linework tool (LW) to override edges.
    </p>
  ) : (
    (el.lineworkOverrides ?? []).map((ov) => (
      <div
        key={ov.elementId}
        data-testid={`inspector-linework-override-${ov.elementId}`}
        style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 2 }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            background: ov.colorHex,
            border: '1px solid #888',
            display: 'inline-block',
          }}
        />
        <span style={{ fontSize: 11, flex: 1 }}>
          {ov.elementId.slice(0, 8)}… {ov.lineWeightPx}px
        </span>
        <button
          data-testid={`inspector-linework-remove-${ov.elementId}`}
          onClick={() => {
            const next = (el.lineworkOverrides ?? []).filter((o) => o.elementId !== ov.elementId);
            onPropertyChange('lineworkOverrides', next);
          }}
          style={{ fontSize: 10 }}
        >
          ×
        </button>
      </div>
    ))
  )}
  {(el.lineworkOverrides ?? []).length > 0 && (
    <button
      data-testid="inspector-linework-clear-all"
      onClick={() => onPropertyChange('lineworkOverrides', [])}
      style={{ fontSize: 11 }}
    >
      Clear All
    </button>
  )}
</CollapsibleSection>
```

---

### H — Tests

`packages/web/src/plan/lineworkOverride.test.ts`:

```ts
describe('linework override — §3.3.7', () => {
  it('grammar starts in idle state', () => { ... });
  it('activating tool transitions to active state', () => { ... });
  it('click in active state emits applyLineworkOverride effect with elementId', () => { ... });
  it('escape from active state returns to idle', () => { ... });
});
```

`packages/web/src/plan/lineworkOverrideMerge.test.ts`:

```ts
describe('linework override deduplication', () => {
  it('adding override for same elementId replaces the old one', () => {
    const existing = [{ elementId: 'abc', colorHex: '#red', lineWeightPx: 1 }];
    const newOv = { elementId: 'abc', colorHex: '#00ff00', lineWeightPx: 2 };
    const result = [...existing.filter((o) => o.elementId !== newOv.elementId), newOv];
    expect(result).toHaveLength(1);
    expect(result[0]!.colorHex).toBe('#00ff00');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave15/I): linework override tool (§3.3.7)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new linework tests.
