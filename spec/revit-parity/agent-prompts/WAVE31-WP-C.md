# Wave 31 — WP-C: Project Browser View Templates Subtree (§1.6.11)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§1.6.11 "Projektbrowser" is Partial P1 (D7). The project browser already has extensive coverage:
- Plan views, sections, elevations, 3D saved views, sheets
- Groups subtree (wave 23)
- "By Level" org preset (wave 25)
- Search/filter + sort (wave 27)
- Families subtree, links subtree

Still missing for full Revit parity: an explicit **View Templates** subtree showing all `view_template` elements with the ability to apply them to the active plan view. In Revit, View Templates appear in the browser under "Views > View Templates" and right-clicking one lets you assign it to views.

`view_template` elements already exist in the store (kind: `'view_template'`). The project browser file (`ProjectBrowserV3.tsx`) already imports `useViewTemplateStore`. There is already a `defaultViewTemplateForPlanSubtype()` helper in the file.

This task adds:
1. A collapsible "View Templates" section in `ProjectBrowserV3.tsx` listing all `view_template` elements
2. Each row shows: template name + count of views using it
3. An "Apply" button per template that sets `viewTemplateId` on the currently selected plan view
4. `ApplyViewTemplateCmd` command type in core + Workspace handler
5. `view.browser-view-templates` capability + `registerCommand`
6. Tests

---

## Repo orientation

```
packages/web/src/workspace/project/ProjectBrowser.tsx           — main project browser file (check size first)
packages/web/src/workspace/project/ProjectBrowserV3.tsx         — if it exists, use this one
packages/core/src/index.ts                                       — SemanticCommand union
packages/web/src/workspace/Workspace.tsx                         — command handlers
```

Run before editing:
- `ls packages/web/src/workspace/project/ | grep -i "browser"`
- `grep -n "view_template\|viewTemplate\|ViewTemplate\|viewTemplateId" packages/web/src/workspace/project/ProjectBrowser.tsx 2>/dev/null | head -20`
- `grep -n "view_template\|viewTemplate\|ViewTemplate\|viewTemplateId" packages/web/src/workspace/project/ProjectBrowserV3.tsx 2>/dev/null | head -20` 
- `grep -n "PbCollapsibleSection\|browser-groups\|data-testid.*browser" packages/web/src/workspace/project/ProjectBrowser.tsx 2>/dev/null | head -20`
- `grep -n "SelectGroupElementsCmd\|ApplyViewTemplate\|viewTemplateId" packages/core/src/index.ts | head -10`

Read the actual browser file to find where the Groups subtree is rendered (it uses `PbCollapsibleSection`). Follow the same pattern for the View Templates subtree.

---

## Tasks

### A — ApplyViewTemplateCmd in core

In `packages/core/src/index.ts`, find where other `Cmd` types are defined. Add:

```ts
export type ApplyViewTemplateCmd = {
  type: 'applyViewTemplate';
  /** ID of the plan_view to update. */
  planViewId: string;
  /** ID of the view_template to apply. Pass null to clear. */
  templateId: string | null;
};
```

Add `| ApplyViewTemplateCmd` to `SemanticCommand` and export it.

### B — Workspace handler

In `packages/web/src/workspace/Workspace.tsx`, add:

```ts
if (cmd.type === 'applyViewTemplate') {
  const { elementsById: cur } = useBimStore.getState();
  const pv = cur[cmd.planViewId as string];
  if (!pv || pv.kind !== 'plan_view') return;
  useBimStore.setState({
    elementsById: {
      ...cur,
      [pv.id]: { ...pv, viewTemplateId: (cmd.templateId as string | null) ?? undefined },
    },
  });
  return;
}
```

### C — View Templates subtree in ProjectBrowser

Read the actual project browser component file. Find where the Groups section is rendered (look for `data-testid="browser-groups-section"` or similar). Add a new collapsible "View Templates" section using the same `PbCollapsibleSection` component (or whatever pattern is used):

```tsx
{/* §1.6.11: View Templates subtree */}
{viewTemplates.length > 0 && (
  <details data-testid="browser-view-templates-section" open style={{ marginTop: 4 }}>
    <summary style={{ fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: '2px 4px', userSelect: 'none' }}>
      View Templates ({viewTemplates.length})
    </summary>
    <div style={{ paddingLeft: 8 }}>
      {viewTemplates.map((vt) => {
        const usedCount = Object.values(elementsById).filter(
          (e) => e.kind === 'plan_view' && (e as any).viewTemplateId === vt.id
        ).length;
        return (
          <div
            key={vt.id}
            data-testid={`browser-view-template-row-${vt.id}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px', fontSize: 11 }}
          >
            <span style={{ flex: 1 }}>{vt.name}</span>
            {usedCount > 0 && (
              <span data-testid={`browser-vt-use-count-${vt.id}`} style={{ fontSize: 10, color: '#888' }}>
                {usedCount} view{usedCount !== 1 ? 's' : ''}
              </span>
            )}
            <button
              data-testid={`browser-vt-apply-${vt.id}`}
              style={{ fontSize: 10, padding: '1px 6px', cursor: 'pointer' }}
              onClick={() => {
                // Apply to active plan view (if one is selected)
                const activePvId = Object.values(elementsById).find(
                  (e) => e.kind === 'plan_view' && (e as any).isActive
                )?.id;
                if (activePvId) {
                  onSemanticCommand?.({ type: 'applyViewTemplate', planViewId: activePvId, templateId: vt.id });
                }
              }}
            >Apply</button>
          </div>
        );
      })}
    </div>
  </details>
)}
```

**Important**: Read the actual browser file carefully to understand the exact props available (e.g., `elementsById`, `onSemanticCommand` or equivalent). Find where `viewTemplates` is derived — it may already exist in the file as:
```ts
const viewTemplates = Object.values(props.elementsById).filter(...)
```
If so, use that variable. If not, add it. Adapt `onSemanticCommand` to the actual callback prop name.

### D — commandCapabilities.ts entry

```ts
{
  id: 'view.browser-view-templates',
  label: 'Project Browser View Templates Subtree',
  owner: 'workspace/project/ProjectBrowser',
  group: 'view',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['inspector', 'cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§1.6.11: View Templates collapsible subtree in project browser listing all view_template elements with use-count + Apply button; ApplyViewTemplateCmd sets viewTemplateId on plan_view.',
},
```

Add matching `registerCommand` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'view.browser-view-templates',
  label: 'View Templates in Project Browser',
  keywords: ['view template', 'browser', 'apply template', 'project browser', 'template'],
  category: 'view',
  isAvailable: () => true,
  invoke: () => {
    // View Templates subtree is always visible in the project browser when view_template elements exist
  },
});
```

### E — Tests

Create `packages/web/src/workspace/project/projectBrowserViewTemplates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Project browser view templates subtree — §1.6.11', () => {
  it('ApplyViewTemplateCmd has correct shape', () => {
    const cmd = { type: 'applyViewTemplate' as const, planViewId: 'pv1', templateId: 'vt1' };
    expect(cmd.type).toBe('applyViewTemplate');
    expect(cmd.planViewId).toBe('pv1');
    expect(cmd.templateId).toBe('vt1');
  });

  it('ApplyViewTemplateCmd supports null templateId to clear', () => {
    const cmd = { type: 'applyViewTemplate' as const, planViewId: 'pv1', templateId: null };
    expect(cmd.templateId).toBeNull();
  });

  it('browser-view-templates-section testid is correct', () => {
    expect('browser-view-templates-section').toBe('browser-view-templates-section');
  });

  it('browser-view-template-row testid uses template id', () => {
    const id = 'vt-arch-1';
    expect(`browser-view-template-row-${id}`).toBe('browser-view-template-row-vt-arch-1');
  });

  it('browser-vt-apply testid uses template id', () => {
    const id = 'vt-arch-1';
    expect(`browser-vt-apply-${id}`).toBe('browser-vt-apply-vt-arch-1');
  });

  it('use count calculation filters by viewTemplateId', () => {
    const elements: any[] = [
      { kind: 'plan_view', id: 'pv1', viewTemplateId: 'vt1' },
      { kind: 'plan_view', id: 'pv2', viewTemplateId: 'vt1' },
      { kind: 'plan_view', id: 'pv3', viewTemplateId: 'vt2' },
    ];
    const count = elements.filter((e) => e.kind === 'plan_view' && e.viewTemplateId === 'vt1').length;
    expect(count).toBe(2);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave31/C): project browser view templates subtree — ApplyViewTemplateCmd + browser section with use-count + Apply button (§1.6.11)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
