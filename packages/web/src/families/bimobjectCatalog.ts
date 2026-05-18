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
