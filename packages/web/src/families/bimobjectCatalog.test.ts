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
