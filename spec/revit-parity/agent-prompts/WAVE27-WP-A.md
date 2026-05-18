# Wave 27 — WP-A: Link IFC Tracker Fix + Link PDF Underlay (§12.1.1)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§12.1.1 "Verknüpfungen" (linked files) is Partial. The tracker currently says "Link IFC: Not Started" but wave 19 WP-C already implemented it (`link_ifc` element type + `addIfcLink`/`removeIfcLink`/`toggleIfcLinkVisibility` commands + `ManageLinksDialog` IFC section + ghost rendering). This needs to be properly reflected.

Still genuinely missing: **Link PDF as underlay** — placing a PDF page as a translucent visual underlay for tracing over (common in Revit for site plans, survey drawings).

This task adds:
1. `link_pdf` element type in core (url, pageIndex, opacity, positionMm, scaleMm, levelId)
2. `AddPdfLinkCmd` / `RemovePdfLinkCmd` / `TogglePdfLinkCmd` commands
3. Workspace handlers
4. ManageLinksDialog PDF section (file input + opacity slider)
5. Plan canvas rendering of PDF underlay (as an `<img>` overlay or placeholder rectangle)
6. `file.link-pdf` palette command
7. Tests

---

## Repo orientation

```
packages/core/src/index.ts                     — find link_ifc, link_model element types as pattern
packages/web/src/workspace/Workspace.tsx       — find addIfcLink handler as pattern
packages/web/src/workspace/ManageLinksDialog.tsx — find IFC section as pattern for PDF section
packages/web/src/plan/PlanCanvas.tsx           — find dxfUnderlay rendering as pattern for PDF
packages/web/src/cmdPalette/defaultCommands.ts — find 'file.link-ifc' or similar
```

Run before editing:
- `grep -n "link_ifc\|link_pdf\|addIfcLink\|AddIfcLink" packages/core/src/index.ts | head -10`
- `grep -n "link_ifc\|addIfcLink\|pdf" packages/web/src/workspace/Workspace.tsx | head -10`
- `grep -n "link_ifc\|IFC\|pdf\|PDF" packages/web/src/workspace/ManageLinksDialog.tsx | head -15`

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Add link_pdf element type in packages/core/src/index.ts

Find `link_ifc` union member. After it, add:

```ts
| {
    kind: 'link_pdf';
    id: string;
    /** Data URL or blob URL of the PDF page image (client-side only). */
    url: string;
    /** Page index (0-based). */
    pageIndex: number;
    /** Opacity 0–1. Default 0.5. */
    opacity: number;
    /** Origin position in plan (mm). */
    positionMm: { xMm: number; yMm: number };
    /** Scale factor: mm per pixel of the original image. Default 1. */
    scaleMm: number;
    levelId: string;
    hidden?: boolean;
  }
```

Add `'link_pdf'` to the `ElemKind` union.

### B — Add AddPdfLinkCmd / RemovePdfLinkCmd / TogglePdfLinkCmd

Find where `AddIfcLinkCmd`/`RemoveIfcLinkCmd` are defined. Add:

```ts
export type AddPdfLinkCmd = {
  type: 'addPdfLink';
  url: string;
  pageIndex?: number;
  opacity?: number;
  positionMm?: { xMm: number; yMm: number };
  scaleMm?: number;
  levelId: string;
};

export type RemovePdfLinkCmd = {
  type: 'removePdfLink';
  linkId: string;
};

export type TogglePdfLinkCmd = {
  type: 'togglePdfLink';
  linkId: string;
};
```

Add all three to `SemanticCommand` and export them.

### C — Workspace handlers in Workspace.tsx

Find the `addIfcLink` / `removeIfcLink` handlers. Add nearby:

```ts
if (cmd.type === 'addPdfLink') {
  const newId = crypto.randomUUID();
  const { elementsById: cur } = useBimStore.getState();
  useBimStore.setState({
    elementsById: {
      ...cur,
      [newId]: {
        kind: 'link_pdf',
        id: newId,
        url: cmd.url as string,
        pageIndex: (cmd.pageIndex as number | undefined) ?? 0,
        opacity: (cmd.opacity as number | undefined) ?? 0.5,
        positionMm: (cmd.positionMm as any) ?? { xMm: 0, yMm: 0 },
        scaleMm: (cmd.scaleMm as number | undefined) ?? 1,
        levelId: cmd.levelId as string,
        hidden: false,
      } as any,
    },
  });
  return;
}
if (cmd.type === 'removePdfLink') {
  const { elementsById: cur } = useBimStore.getState();
  const { [cmd.linkId as string]: _, ...rest } = cur;
  useBimStore.setState({ elementsById: rest });
  return;
}
if (cmd.type === 'togglePdfLink') {
  const { elementsById: cur } = useBimStore.getState();
  const link = cur[cmd.linkId as string];
  if (!link) return;
  useBimStore.setState({
    elementsById: { ...cur, [link.id]: { ...link, hidden: !(link as any).hidden } as any },
  });
  return;
}
```

### D — ManageLinksDialog PDF section

In `ManageLinksDialog.tsx`, find the IFC section. Add a "PDF Underlays" section after it:

```tsx
{/* PDF Underlays section */}
<div style={{ marginTop: 16 }}>
  <div className="text-xs font-semibold mb-2">PDF Underlays</div>
  {pdfLinks.map((link) => (
    <div key={link.id} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 11, flex: 1 }}>PDF p.{(link as any).pageIndex + 1}</span>
      <input
        type="range" min={0} max={1} step={0.05}
        value={(link as any).opacity}
        data-testid={`pdf-link-opacity-${link.id}`}
        onChange={(e) =>
          onSemanticCommand?.({ type: 'updateElementProperty', elementId: link.id, property: 'opacity', value: parseFloat(e.target.value) })
        }
        style={{ width: 80 }}
      />
      <button
        data-testid={`pdf-link-toggle-${link.id}`}
        onClick={() => onSemanticCommand?.({ type: 'togglePdfLink', linkId: link.id })}
        style={{ fontSize: 11, padding: '1px 6px' }}
      >
        {(link as any).hidden ? 'Show' : 'Hide'}
      </button>
      <button
        data-testid={`pdf-link-remove-${link.id}`}
        onClick={() => onSemanticCommand?.({ type: 'removePdfLink', linkId: link.id })}
        style={{ fontSize: 11, padding: '1px 6px', color: '#f87171' }}
      >
        Remove
      </button>
    </div>
  ))}
  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer', marginTop: 4 }}>
    <input
      type="file" accept="image/*,.pdf"
      data-testid="pdf-link-file-input"
      style={{ display: 'none' }}
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            onSemanticCommand?.({ type: 'addPdfLink', url: ev.target.result as string, levelId: activeLevelId ?? '' });
          }
        };
        reader.readAsDataURL(file);
      }}
    />
    <span style={{ padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 4 }}>+ Add PDF Underlay</span>
  </label>
</div>
```

Where `pdfLinks` is computed from `elements.filter((el) => el.kind === 'link_pdf')` and `activeLevelId` is available from props. Adapt to the actual component structure.

### E — palette command

In `defaultCommands.ts`, add:

```ts
registerCommand({
  id: 'file.link-pdf',
  label: 'Link PDF Underlay',
  keywords: ['pdf', 'underlay', 'link', 'attach'],
  category: 'file',
  isAvailable: () => true,
  invoke: (_ctx) => {
    // Open ManageLinksDialog — adapt to actual open-dialog mechanism
    useBimStore.getState().setManageLinksOpen?.(true);
  },
});
```

Adapt the `invoke` to the actual store API for opening ManageLinksDialog. If no such method exists, add a `manageLinksOpen` boolean field to the store and wire it to a `setManageLinksOpen` action.

### F — commandCapabilities.ts entry

```ts
{
  id: 'file.link-pdf',
  label: 'Link PDF Underlay',
  owner: 'workspace/ManageLinksDialog',
  group: 'file',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['cmd-k', 'manage-links-dialog'],
  executionSurface: 'store',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§12.1.1: links a PDF/image as a plan underlay; stored as link_pdf element with opacity, position, scale.',
},
```

### G — Tests

Create `packages/web/src/workspace/pdfLink.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

describe('PDF link underlay — §12.1.1', () => {
  it('AddPdfLinkCmd has correct shape', () => {
    const cmd = { type: 'addPdfLink' as const, url: 'data:image/png;base64,...', levelId: 'l1' };
    expect(cmd.type).toBe('addPdfLink');
    expect(cmd.levelId).toBe('l1');
  });

  it('link_pdf element has required fields', () => {
    const el: any = {
      kind: 'link_pdf',
      id: 'pdf-01',
      url: 'data:image/png;base64,...',
      pageIndex: 0,
      opacity: 0.5,
      positionMm: { xMm: 0, yMm: 0 },
      scaleMm: 1,
      levelId: 'l1',
    };
    expect(el.kind).toBe('link_pdf');
    expect(el.opacity).toBe(0.5);
  });

  it('opacity defaults to 0.5 when not specified', () => {
    const cmd: any = { type: 'addPdfLink', url: 'x', levelId: 'l1' };
    const opacity = (cmd.opacity as number | undefined) ?? 0.5;
    expect(opacity).toBe(0.5);
  });

  it('toggle flips hidden flag', () => {
    const link: any = { hidden: false };
    const toggled = !link.hidden;
    expect(toggled).toBe(true);
  });

  it('RemovePdfLinkCmd has correct shape', () => {
    const cmd = { type: 'removePdfLink' as const, linkId: 'pdf-01' };
    expect(cmd.linkId).toBe('pdf-01');
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave27/A): PDF underlay link — link_pdf element + AddPdfLinkCmd/RemovePdfLinkCmd/TogglePdfLinkCmd + Workspace handlers + ManageLinksDialog PDF section + file.link-pdf palette command (§12.1.1)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 5 tests.
