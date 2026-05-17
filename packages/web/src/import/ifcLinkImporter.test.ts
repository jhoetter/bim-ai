/** §12.1.1 — ifcLinkImporter tests */

import { describe, expect, it } from 'vitest';
import { applyIfcLinkOffset, createIfcLink } from './ifcLinkImporter';

const MINIMAL_IFC = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('minimal'),'2;1');
FILE_NAME('test.ifc','2024-01-01',(''),(''),'','','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
ENDSEC;
END-ISO-10303-21;
`;

describe('createIfcLink — §12.1.1', () => {
  it('returns a link_ifc element', () => {
    const link = createIfcLink('test.ifc', MINIMAL_IFC);
    expect(link.kind).toBe('link_ifc');
  });

  it('visible defaults to true', () => {
    const link = createIfcLink('test.ifc', MINIMAL_IFC);
    expect(link.visible).toBe(true);
  });

  it('name is set from argument', () => {
    const link = createIfcLink('my-building.ifc', MINIMAL_IFC);
    expect(link.name).toBe('my-building.ifc');
  });

  it('linkedElements is an array', () => {
    const link = createIfcLink('test.ifc', MINIMAL_IFC);
    expect(Array.isArray(link.linkedElements)).toBe(true);
  });
});

describe('applyIfcLinkOffset — §12.1.1', () => {
  it('sets offsetMm on the link', () => {
    const link = createIfcLink('test.ifc', MINIMAL_IFC);
    const offset = { xMm: 100, yMm: 200, zMm: 50 };
    const updated = applyIfcLinkOffset(link, offset);
    expect(updated.offsetMm).toEqual(offset);
  });

  it('does not mutate original link', () => {
    const link = createIfcLink('test.ifc', MINIMAL_IFC);
    const offset = { xMm: 100, yMm: 200, zMm: 50 };
    applyIfcLinkOffset(link, offset);
    expect(link.offsetMm).toBeUndefined();
  });
});
