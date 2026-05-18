# Wave 29 — WP-C: BIMobject Catalog Integration (§12.3)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

§12.3 "Internet-Bibliotheken nutzen: BIMobject" is Not Started P2. Revit lets users browse and download manufacturer-specific BIM families from BIMobject.com. bim-ai has an existing `FamilyLibraryPanel.tsx` with internal and external catalogs, but no BIMobject-specific section.

This task adds a BIMobject catalog section to the family library panel with:

1. `bimobjectCatalog.ts` — curated catalog of 12 BIMobject-style items mapped to existing family types
2. `FamilyLibraryPanel.tsx` — "BIMobject" collapsible section with search + item cards
3. `file.bimobject-catalog` capability entry
4. Tests

---

## Repo orientation

```
packages/web/src/families/FamilyLibraryPanel.tsx        — find panel structure, external catalog sections
packages/web/src/families/familyCatalog.ts              — find family catalog types/loading pattern
packages/web/src/workspace/commandCapabilities.ts       — find file.* entries
packages/web/src/cmdPalette/defaultCommands.ts          — find registerCommand pattern
```

Run before editing:

- `grep -n "BIMobject\|bimobject\|externalCatalog\|section\|collapsible" packages/web/src/families/FamilyLibraryPanel.tsx | head -15`
- `grep -n "FamilyCatalogItem\|CatalogItem\|familyCatalog\|export.*type\|interface" packages/web/src/families/familyCatalog.ts | head -15`
- `grep -n "onPlace\|placeFamilyInstance\|onSelectFamily\|dispatchCommand" packages/web/src/families/FamilyLibraryPanel.tsx | head -10`
- `ls packages/web/src/families/`

Read `FamilyLibraryPanel.tsx` and `familyCatalog.ts` carefully before editing.

Tests: `npx vitest run` from `packages/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Create bimobjectCatalog.ts

Create `packages/web/src/families/bimobjectCatalog.ts`:

```ts
/** §12.3: curated BIMobject-style catalog items mapped to existing family types. */
export interface BimobjectItem {
  id: string;
  name: string;
  manufacturer: string;
  category: string;
  familyTypeId: string;
  thumbnailEmoji: string;
  description: string;
  tags: string[];
}

export const BIMOBJECT_CATALOG: BimobjectItem[] = [
  {
    id: 'bo-chair-01',
    name: 'Bürostuhl Vitra',
    manufacturer: 'Vitra',
    category: 'Seating',
    familyTypeId: 'chair',
    thumbnailEmoji: '🪑',
    description: 'Ergonomischer Bürodrehstuhl',
    tags: ['chair', 'office', 'seating'],
  },
  {
    id: 'bo-table-01',
    name: 'Konferenztisch Wilkhahn',
    manufacturer: 'Wilkhahn',
    category: 'Tables',
    familyTypeId: 'table',
    thumbnailEmoji: '🪞',
    description: 'Konferenztisch 2400x1200mm',
    tags: ['table', 'conference'],
  },
  {
    id: 'bo-sofa-01',
    name: 'Sofa USM',
    manufacturer: 'USM',
    category: 'Seating',
    familyTypeId: 'sofa',
    thumbnailEmoji: '🛋️',
    description: 'Modulares Sitzsystem',
    tags: ['sofa', 'seating', 'lounge'],
  },
  {
    id: 'bo-desk-01',
    name: 'Schreibtisch Steelcase',
    manufacturer: 'Steelcase',
    category: 'Desks',
    familyTypeId: 'desk',
    thumbnailEmoji: '🖥️',
    description: 'Elektrisch höhenverstellbar 1600x800mm',
    tags: ['desk', 'office', 'adjustable'],
  },
  {
    id: 'bo-sink-01',
    name: 'Waschbecken Grohe',
    manufacturer: 'Grohe',
    category: 'Sanitary',
    familyTypeId: 'sink',
    thumbnailEmoji: '🚿',
    description: 'Aufsatzwaschbecken 600x450mm',
    tags: ['sink', 'bathroom', 'sanitary'],
  },
  {
    id: 'bo-toilet-01',
    name: 'WC Geberit',
    manufacturer: 'Geberit',
    category: 'Sanitary',
    familyTypeId: 'toilet',
    thumbnailEmoji: '🚽',
    description: 'Wand-WC mit Unterputzspülkasten',
    tags: ['toilet', 'bathroom', 'sanitary'],
  },
  {
    id: 'bo-door-01',
    name: 'Tür Jeld-Wen',
    manufacturer: 'Jeld-Wen',
    category: 'Doors',
    familyTypeId: 'door-single',
    thumbnailEmoji: '🚪',
    description: 'Einflügelige Innentür 875x2010mm',
    tags: ['door', 'interior'],
  },
  {
    id: 'bo-window-01',
    name: 'Fenster Schüco',
    manufacturer: 'Schüco',
    category: 'Windows',
    familyTypeId: 'window-fixed',
    thumbnailEmoji: '🪟',
    description: 'Festverglasung AWS 75.SI+',
    tags: ['window', 'glazing', 'facade'],
  },
  {
    id: 'bo-lamp-01',
    name: 'Pendelleuchte Louis Poulsen',
    manufacturer: 'Louis Poulsen',
    category: 'Lighting',
    familyTypeId: 'pendant-light',
    thumbnailEmoji: '💡',
    description: 'PH 5 Pendelleuchte Ø500mm',
    tags: ['light', 'pendant', 'ceiling'],
  },
  {
    id: 'bo-radiator-01',
    name: 'Heizkörper Zehnder',
    manufacturer: 'Zehnder',
    category: 'HVAC',
    familyTypeId: 'radiator',
    thumbnailEmoji: '🌡️',
    description: 'Plattenheizkörper 600x1000mm',
    tags: ['radiator', 'heating', 'hvac'],
  },
  {
    id: 'bo-shelf-01',
    name: 'Regal String',
    manufacturer: 'String Furniture',
    category: 'Storage',
    familyTypeId: 'bookshelf',
    thumbnailEmoji: '📚',
    description: 'Wandregal 78x58cm modular',
    tags: ['shelf', 'storage', 'wall'],
  },
  {
    id: 'bo-kitchen-01',
    name: 'Küchenzeile Bulthaup',
    manufacturer: 'Bulthaup',
    category: 'Kitchen',
    familyTypeId: 'kitchen-unit',
    thumbnailEmoji: '🍳',
    description: 'b3 Küchenzeile 3600mm',
    tags: ['kitchen', 'cabinet', 'cooking'],
  },
];

export function searchBimobjectCatalog(query: string): BimobjectItem[] {
  if (!query.trim()) return BIMOBJECT_CATALOG;
  const q = query.toLowerCase();
  return BIMOBJECT_CATALOG.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.manufacturer.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.tags.some((t) => t.includes(q)),
  );
}
```

### B — Add BIMobject section to FamilyLibraryPanel.tsx

Read `FamilyLibraryPanel.tsx` carefully to understand:

- How the panel is structured (collapsible sections, search, item cards)
- What props/callbacks handle item placement (`onPlace`, `onSelectFamily`, or `dispatchCommand`)
- How to add a new collapsible section

Add a "BIMobject" collapsible section in the panel. Import `BIMOBJECT_CATALOG`, `searchBimobjectCatalog`, and `BimobjectItem` from `'./bimobjectCatalog'`.

The section should show:

1. A search input (`data-testid="bimobject-search-input"`)
2. Item cards showing `thumbnailEmoji`, `name`, `manufacturer`, `description`
3. A "Use" / "Place" button per item (`data-testid="bimobject-item-{id}"`) that places the family

**Important**: Read `FamilyLibraryPanel.tsx` carefully before adding. Adapt to the actual prop signatures and styling conventions used in the file.

### C — commandCapabilities.ts entry

```ts
{
  id: 'file.bimobject-catalog',
  label: 'BIMobject Online Catalog',
  owner: 'families/FamilyLibraryPanel',
  group: 'file',
  scope: 'global',
  intendedModes: ['plan', '3d'],
  surfaces: ['family-library', 'cmd-k'],
  executionSurface: 'local-state',
  preconditions: [],
  status: 'implemented',
  usabilityScore: 8,
  notes: '§12.3: curated BIMobject catalog with 12 manufacturer items (chairs, tables, sanitary, doors, windows, lighting, HVAC); searchable by name/manufacturer/category/tag.',
},
```

Add a matching `registerCommand` for `file.bimobject-catalog` in `defaultCommands.ts`:

```ts
registerCommand({
  id: 'file.bimobject-catalog',
  label: 'BIMobject Online Catalog',
  keywords: ['bimobject', 'catalog', 'manufacturer', 'furniture', 'online library', 'family load'],
  category: 'file',
  isAvailable: () => true,
  invoke: (ctx) => {
    ctx.openFamilyLibrary?.();
  },
});
```

### D — Tests

Create `packages/web/src/families/bimobjectCatalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { BIMOBJECT_CATALOG, searchBimobjectCatalog } from './bimobjectCatalog';

describe('BIMobject catalog — §12.3', () => {
  it('catalog has at least 10 items', () => {
    expect(BIMOBJECT_CATALOG.length).toBeGreaterThanOrEqual(10);
  });

  it('each item has required fields', () => {
    for (const item of BIMOBJECT_CATALOG) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.manufacturer).toBeTruthy();
      expect(item.familyTypeId).toBeTruthy();
    }
  });

  it('searchBimobjectCatalog returns all items for empty query', () => {
    const results = searchBimobjectCatalog('');
    expect(results.length).toBe(BIMOBJECT_CATALOG.length);
  });

  it('searchBimobjectCatalog filters by name', () => {
    const results = searchBimobjectCatalog('Vitra');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].manufacturer).toBe('Vitra');
  });

  it('searchBimobjectCatalog filters by tag', () => {
    const results = searchBimobjectCatalog('bathroom');
    expect(results.length).toBeGreaterThan(0);
  });

  it('searchBimobjectCatalog returns empty for no match', () => {
    const results = searchBimobjectCatalog('xyznonexistent123');
    expect(results.length).toBe(0);
  });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave29/C): BIMobject catalog integration — bimobjectCatalog.ts with 12 manufacturer items + FamilyLibraryPanel BIMobject section + search (§12.3)"
git push origin main
```

## Success criterion

`npx vitest run` from `packages/web` — all tests pass including the new 6 tests.
