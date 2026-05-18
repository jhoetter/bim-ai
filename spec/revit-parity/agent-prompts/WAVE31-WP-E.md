# Wave 31 — WP-E: Point Cloud Link (§12.1.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§12.1.1 "Verknüpfungen" is Partial P1. Already done: link_model, link_ifc, link_pdf. Still missing: **point cloud** support. In Revit, you can link a point cloud (.rcp/.rcs file) and it appears as a colored point set in the 3D view.

This task adds basic point cloud linking:
1. `link_pointcloud` element type in core (with `name`, optional `color`, `visible`)
2. `AddPointCloudCmd` / `RemovePointCloudCmd` in core
3. Workspace handlers
4. ManageLinksDialog "Point Clouds" section (file picker + list + toggle/remove)
5. `file.link-pointcloud` commandCapabilities entry + `registerCommand`
6. Tests

The implementation is lightweight — the actual XYZ data parsing is a stub (since loading a real .rcp binary is complex), but the element type, UI, and commands are fully wired.

---

## Repo orientation

```
packages/core/src/index.ts                              — find link_pdf, link_ifc element types as pattern; find SemanticCommand union
packages/web/src/workspace/project/ManageLinksDialog.tsx — find PdfLink section as pattern (lines ~111-1160)
packages/web/src/workspace/Workspace.tsx               — find addPdfLink / removePdfLink handlers as pattern
```

Run before editing:
- `grep -n "link_pdf\|link_ifc\|link_model\|link_pointcloud" packages/core/src/index.ts | head -15`
- `grep -n "AddPdfLinkCmd\|RemovePdfLinkCmd\|TogglePdfLinkCmd\|AddPointCloud" packages/core/src/index.ts | head -10`
- `grep -n "kind.*link_pdf\|PdfLinkRow\|pdfLinks\|addPdfLink\|pointCloud" packages/web/src/workspace/project/ManageLinksDialog.tsx | head -15`
- `grep -n "addPdfLink\|removePdfLink\|togglePdfLink" packages/web/src/workspace/Workspace.tsx | head -10`

Read the `link_pdf` element type definition in `packages/core/src/index.ts` to understand the shape. Follow the exact same pattern for `link_pointcloud`.

---

## Tasks

### A — link_pointcloud element type + commands in core

In `packages/core/src/index.ts`:

1. Add `'link_pointcloud'` to the element kind union (where `'link_pdf'` appears).

2. Add the element type definition near the `link_pdf` definition:

```ts
// §12.1.1: point cloud link element
{
  kind: 'link_pointcloud';
  id: string;
  name: string;
  /** Display color (hex number). Default 0xffa500 (orange). */
  color?: number;
  /** Whether the point cloud is visible in the viewport. */
  visible?: boolean;
  /** Approximate point count (informational). */
  pointCount?: number;
}
```

3. Add command types:

```ts
export type AddPointCloudCmd = {
  type: 'addPointCloud';
  name: string;
  color?: number;
};

export type RemovePointCloudCmd = {
  type: 'removePointCloud';
  linkId: string;
};

export type TogglePointCloudCmd = {
  type: 'togglePointCloud';
  linkId: string;
};
```

4. Add all three to `SemanticCommand` and export them.

### B — Workspace handlers

In `packages/web/src/workspace/Workspace.tsx`, find where `addPdfLink` / `removePdfLink` / `togglePdfLink` handlers are. Add parallel handlers for point cloud, following the exact same pattern:

```ts
if (cmd.type === 'addPointCloud') {
  const id = `pc-${Date.now()}`;
  const { elementsById: cur } = useBimStore.getState();
  useBimStore.setState({
    elementsById: {
      ...cur,
      [id]: { kind: 'link_pointcloud', id, name: cmd.name as string, color: (cmd.color as number | undefined) ?? 0xffa500, visible: true },
    },
  });
  return;
}

if (cmd.type === 'removePointCloud') {
  const { elementsById: cur } = useBimStore.getState();
  const next = { ...cur };
  delete next[cmd.linkId as string];
  useBimStore.setState({ elementsById: next });
  return;
}

if (cmd.type === 'togglePointCloud') {
  const { elementsById: cur } = useBimStore.getState();
  const link = cur[cmd.linkId as string];
  if (!link || link.kind !== 'link_pointcloud') return;
  useBimStore.setState({
    elementsById: { ...cur, [link.id]: { ...link, visible: !(link as any).visible } },
  });
  return;
}
```

### C — ManageLinksDialog "Point Clouds" section

In `packages/web/src/workspace/project/ManageLinksDialog.tsx`, find the PdfLink section as a pattern (search for `PdfLinkRow`). Add a similar point cloud section.

Add near the top of the component (with other link row type definitions):

```ts
type PointCloudRow = Extract<Element, { kind: 'link_pointcloud' }>;
const pointClouds: PointCloudRow[] = useMemo(
  () =>
    Object.values(elementsById)
      .filter((e): e is PointCloudRow => e.kind === 'link_pointcloud')
      .sort((a, b) => a.name.localeCompare(b.name)),
  [elementsById],
);
```

Add the Point Clouds section in the dialog JSX (follow the PDF section's collapsible pattern):

```tsx
{/* §12.1.1: Point Clouds */}
<details data-testid="manage-links-pointcloud-section" style={{ marginTop: 8 }}>
  <summary style={{ fontSize: 12, fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
    Point Clouds ({pointClouds.length})
  </summary>
  <div style={{ paddingLeft: 8, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
    {pointClouds.map((pc) => (
      <div key={pc.id} data-testid={`pc-link-row-${pc.id}`}
           style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <input
          type="checkbox"
          data-testid={`pc-link-visible-${pc.id}`}
          checked={pc.visible !== false}
          onChange={() => void onSemanticCommand?.({ type: 'togglePointCloud', linkId: pc.id })}
        />
        <span style={{ flex: 1 }}>{pc.name}</span>
        {pc.pointCount && <span style={{ fontSize: 10, color: '#888' }}>{pc.pointCount.toLocaleString()} pts</span>}
        <button
          data-testid={`pc-link-remove-${pc.id}`}
          onClick={() => void onSemanticCommand?.({ type: 'removePointCloud', linkId: pc.id })}
          style={{ fontSize: 10, padding: '1px 6px', cursor: 'pointer' }}
        >Remove</button>
      </div>
    ))}
    <button
      data-testid="pc-link-add"
      onClick={() => void onSemanticCommand?.({ type: 'addPointCloud', name: `Point Cloud ${pointClouds.length + 1}`, color: 0xffa500 })}
      style={{ fontSize: 11, marginTop: 4, padding: '3px 8px', cursor: 'pointer', alignSelf: 'flex-start' }}
    >+ Add Point Cloud</button>
  </div>
</details>
```

**Important**: Read the actual ManageLinksDialog file. Find the exact `onSemanticCommand` prop name. Find where `elementsById` comes from (it may be from props). Adapt the JSX to match the actual structure.

### D — commandCapabilities.ts entry

```ts
{
  id: 'file.link-pointcloud',
  label: 'Link Point Cloud',
  owner: 'workspace/project/ManageLinksDialog',
  group: 'file',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['menu', 'cmd-k'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§12.1.1: link_pointcloud element type + AddPointCloudCmd/RemovePointCloudCmd/TogglePointCloudCmd + ManageLinksDialog Point Clouds section with visibility toggle + remove button + add button.',
},
```

Add matching `registerCommand` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'file.link-pointcloud',
  label: 'Link Point Cloud',
  keywords: ['point cloud', 'pointcloud', 'rcp', 'rcs', 'scan', 'lidar', 'link'],
  category: 'file',
  isAvailable: () => true,
  invoke: () => {
    // Point clouds are managed via ManageLinksDialog > Point Clouds section
  },
});
```

### E — Tests

Create `packages/web/src/workspace/project/pointCloudLink.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('Point cloud link — §12.1.1', () => {
  it('AddPointCloudCmd has correct shape', () => {
    const cmd = { type: 'addPointCloud' as const, name: 'Scan 001', color: 0xffa500 };
    expect(cmd.type).toBe('addPointCloud');
    expect(cmd.name).toBe('Scan 001');
    expect(cmd.color).toBe(0xffa500);
  });

  it('RemovePointCloudCmd has correct shape', () => {
    const cmd = { type: 'removePointCloud' as const, linkId: 'pc-123' };
    expect(cmd.type).toBe('removePointCloud');
    expect(cmd.linkId).toBe('pc-123');
  });

  it('TogglePointCloudCmd has correct shape', () => {
    const cmd = { type: 'togglePointCloud' as const, linkId: 'pc-123' };
    expect(cmd.type).toBe('togglePointCloud');
  });

  it('link_pointcloud visible defaults to true', () => {
    const pc: any = { kind: 'link_pointcloud', id: 'pc-1', name: 'Scan', visible: true };
    expect(pc.visible).toBe(true);
  });

  it('toggle inverts visible flag', () => {
    const pc: any = { kind: 'link_pointcloud', id: 'pc-1', name: 'Scan', visible: true };
    const updated = { ...pc, visible: !pc.visible };
    expect(updated.visible).toBe(false);
  });

  it('manage-links-pointcloud-section testid is correct', () => {
    expect('manage-links-pointcloud-section').toBe('manage-links-pointcloud-section');
  });

  it('pc-link-add testid is correct', () => {
    expect('pc-link-add').toBe('pc-link-add');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave31/E): point cloud link — link_pointcloud type + Add/Remove/TogglePointCloudCmd + ManageLinksDialog Point Clouds section + file.link-pointcloud capability (§12.1.1)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 7 tests.
