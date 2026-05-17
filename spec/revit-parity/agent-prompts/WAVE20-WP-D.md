# Wave 20 — WP-D: Family Library Panel — Search + Category Count Badges (§1.11)

You are an agent working on the **bim-ai** repo (`/Users/jhoetter/repos/bim-ai`).
bim-ai is a browser-based BIM authoring tool (React + TypeScript + Three.js, Vite, Vitest).
This prompt is self-contained — start here.

---

## Context

`FamilyLibraryPanel.tsx` exists and shows families from internal + external catalogs. It is missing:
- A search/filter input to narrow the displayed families
- Category count badges (showing how many family types exist per category)
- A "recently placed" section listing the last 5 family types used

---

## Repo orientation

```
packages/web/src/                   — find FamilyLibraryPanel.tsx with:
  find packages/web/src -name "FamilyLibraryPanel*"
packages/core/src/index.ts          — family_type, asset_library_entry element shapes
```

Before editing, **run `find packages/web/src -name "FamilyLibraryPanel*"` to locate the file**. Read it fully to understand the current catalog structure and how categories/types are displayed.

Also check `packages/web/src/workspace/project/ProjectBrowser.tsx` to see if FamilyLibraryPanel is already embedded or separate.

Tests: run `pnpm test --filter @bim-ai/web`.
Prettier runs automatically. **Always `git pull --rebase origin main` before pushing.**

---

## Tasks

### A — Search input

In `FamilyLibraryPanel`, add a search state and filter:

```tsx
const [searchQuery, setSearchQuery] = useState('');

// In render, above the category list:
<input
  type="search"
  data-testid="family-library-search"
  placeholder="Search families…"
  value={searchQuery}
  onChange={e => setSearchQuery(e.target.value)}
  style={{ width: '100%', marginBottom: 8, padding: '2px 6px' }}
/>
```

Apply the filter to the displayed entries — hide any family or category whose name does not include `searchQuery` (case-insensitive). When `searchQuery` is empty, show all.

```ts
const filteredEntries = entries.filter(entry =>
  !searchQuery || entry.name.toLowerCase().includes(searchQuery.toLowerCase())
);
```

(Adjust field names to match what the actual panel uses — read the file first.)

### B — Category count badges

Next to each category heading/button, render a badge with the count of family types in that category:

```tsx
<span data-testid={`family-category-count-${categoryId}`}
  style={{ fontSize: 10, background: '#888', color: '#fff', borderRadius: 8, padding: '1px 5px', marginLeft: 4 }}>
  {count}
</span>
```

Where `count` is the number of entries (or family types) in that category that match the current `searchQuery`.

### C — Recently placed section

Add a `recentFamilyIds` array stored in component state (or a lightweight Zustand slice if the panel already has one). When a family type is placed (clicked to place), prepend its ID to `recentFamilyIds` and cap the list at 5.

Render a "Recently Used" collapsible section at the top of the list:

```tsx
{recentFamilyIds.length > 0 && (
  <details open>
    <summary data-testid="family-library-recent-header">Recently Used</summary>
    <ul>
      {recentFamilyIds.map(id => {
        const entry = allEntries.find(e => e.id === id);
        if (!entry) return null;
        return (
          <li key={id} data-testid={`family-library-recent-${id}`}
            onClick={() => handlePlaceFamily(entry)}
            style={{ cursor: 'pointer', padding: '2px 4px' }}>
            {entry.name}
          </li>
        );
      })}
    </ul>
  </details>
)}
```

### D — Tests

`packages/web/src/workspace/familyLibrarySearch.test.tsx` (or nearest appropriate test file):

```tsx
describe('FamilyLibraryPanel search + badges — §1.11', () => {
  it('renders search input', () => { ... });
  it('filters entries by search query', () => { ... });
  it('shows all entries when search is empty', () => { ... });
  it('renders category count badge', () => { ... });
  it('renders recently used section when items placed', () => { ... });
});
```

---

## Commit and push

```
git pull --rebase origin main
git add -p
git commit -m "feat(wave20/D): family library panel — search input + category count badges + recently used section (§1.11)"
git push origin main
```

## Success criterion

`pnpm test --filter @bim-ai/web` — all tests pass.
