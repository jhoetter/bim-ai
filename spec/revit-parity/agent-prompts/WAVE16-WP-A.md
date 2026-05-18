# Wave 16 — WP-A: IFC Import (§12.1.2)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Repo orientation

```
packages/web/src/export/ifcExporter.ts          — IFC 2x3 exporter (pure-TS ISO 10303-21 writer; read for format reference)
packages/web/src/workspace/Workspace.tsx         — semantic command handlers
packages/web/src/cmdPalette/defaultCommands.ts   — palette command registration
packages/core/src/index.ts                        — element types
```

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## What already exists — read these first

1. **`ifcExporter.ts`**: read the STEP format it produces. It writes `IFCWALL`, `IFCSLAB`, `IFCSPACE` etc. Use the same entity names and attribute positions as the reverse mapping.
2. **`core/index.ts`**: wall, floor, room, door, window element types and their fields.
3. Search for any existing `ifcImport` or `ifcParser` — if found, read it.

---

## Tasks

### A — IFC STEP parser `packages/web/src/import/ifcParser.ts`

Create a pure-TypeScript ISO 10303-21 parser:

```ts
/** Parse a raw IFC STEP string into a flat entity map. */
export function parseIfcStep(text: string): Map<number, IfcEntity> { ... }

export interface IfcEntity {
  id: number;
  type: string;          // e.g. 'IFCWALL'
  attrs: (string | number | null | IfcRef | IfcRef[])[];
}
export interface IfcRef { ref: number }  // #123 reference
```

Tokenise line-by-line. Each DATA line looks like:

```
#12= IFCWALL('guid','owner',name,description,type,#placement,#shape,tag,elem_type);
```

Parse `#N= TYPENAME(attr1, attr2, ...)` where attrs can be strings (`'...'`), numbers, `$` (null), `#N` (ref), `(#N,#N,...)` (list of refs), or `.ENUM.`.

---

### B — Converter `packages/web/src/import/ifcImportConverter.ts`

Convert parsed entities to bim-ai `Element[]`:

```ts
export function convertIfcToElements(entities: Map<number, IfcEntity>): Element[];
```

Handle:

- `IFCWALLSTANDARDCASE` / `IFCWALL` → `wall` element. Extract length from `IFCEXTRUDEDAREASOLID` shape → `lengthMm`. Default `thicknessMm: 200`, `heightMm: 3000`.
- `IFCSLAB` (PredefinedType=FLOOR) → `floor` element.
- `IFCSPACE` → `room` element with `name` from Name attribute.
- `IFCDOOR` → `door` element. Extract width/height from shape if available; default 900/2100.
- `IFCWINDOW` → `window` element. Default 1000/1200.
- `IFCBUILDINGSTOREY` → `level` element with `elevationMm` from Elevation attribute × 1000 (IFC uses metres).

For each element: generate a new `crypto.randomUUID()` as `id`, set `levelId` from the containing storey.

Skip unrecognised entity types.

---

### C — Import dialog `packages/web/src/import/IfcImportDialog.tsx`

```tsx
export function IfcImportDialog({ open, onClose, onImport }: {
  open: boolean;
  onClose: () => void;
  onImport: (elements: Element[]) => void;
}) { ... }
```

- `<input type="file" accept=".ifc" data-testid="ifc-import-file-input" />`
- On file select: `FileReader.readAsText` → `parseIfcStep` → `convertIfcToElements` → preview count label `data-testid="ifc-import-preview-count"` (e.g. "Found: 12 walls, 3 floors, 4 rooms")
- "Import" button `data-testid="ifc-import-btn"` → calls `onImport(elements)` → `onClose()`
- "Cancel" button `data-testid="ifc-import-cancel"`

---

### D — Wire into Workspace.tsx and palette

In `defaultCommands.ts`:

```ts
{ id: 'file.import-ifc', label: 'Import IFC…', keywords: ['ifc', 'import', 'bim'], category: 'command',
  invoke: (ctx) => ctx.openIfcImport?.() }
```

In `Workspace.tsx`:

- Add `ifcImportOpen` state.
- Render `<IfcImportDialog open={ifcImportOpen} onClose={...} onImport={(els) => { els.forEach(el => void onSemanticCommand({ type: 'createElement', element: el })); }} />`
- Wire `openIfcImport: () => setIfcImportOpen(true)` into palette context.

---

### E — Tests

`packages/web/src/import/ifcParser.test.ts`:

```ts
describe('IFC STEP parser — §12.1.2', () => {
  it('parses a minimal STEP string into entity map', () => { ... });
  it('resolves #ref attributes correctly', () => { ... });
  it('handles null $ attributes', () => { ... });
  it('parses list of refs (#N,#M,...)', () => { ... });
});
```

`packages/web/src/import/ifcImportConverter.test.ts`:

```ts
describe('IFC import converter — §12.1.2', () => {
  it('converts IFCWALL to wall element', () => { ... });
  it('converts IFCSPACE to room element with name', () => { ... });
  it('converts IFCBUILDINGSTOREY to level with elevationMm', () => { ... });
  it('ignores unknown entity types', () => { ... });
  it('returns unique ids for each element', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave16/A): IFC import — STEP parser + element converter + dialog (§12.1.2)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass including the new IFC import tests.
