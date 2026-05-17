import { describe, it, expect } from 'vitest';
import { parseIfcStep } from './ifcParser';

const MINIMAL_STEP = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Test'),'2;1');
FILE_NAME('test.ifc','2024-01-01',(''),(''),'','bim-ai','');
FILE_SCHEMA(('IFC2X3'));
ENDSEC;
DATA;
#1= IFCPROJECT('abc',$,'Test Project',$,$,$,$,(#2),#3);
#2= IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#4,$);
#3= IFCUNITASSIGNMENT((#5));
#4= IFCAXIS2PLACEMENT3D(#6,$,$);
#5= IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.);
#6= IFCCARTESIANPOINT((0.,0.,0.));
ENDSEC;
END-ISO-10303-21;`;

describe('IFC STEP parser — §12.1.2', () => {
  it('parses a minimal STEP string into entity map', () => {
    const map = parseIfcStep(MINIMAL_STEP);
    expect(map.size).toBeGreaterThan(0);
    // Check project entity
    const project = map.get(1);
    expect(project).toBeDefined();
    expect(project!.type).toBe('IFCPROJECT');
    expect(project!.id).toBe(1);
  });

  it('resolves #ref attributes correctly', () => {
    const map = parseIfcStep(MINIMAL_STEP);
    const project = map.get(1);
    expect(project).toBeDefined();
    // attr[8] should be a ref to #3 (unit assignment)
    const unitRef = project!.attrs[8];
    expect(unitRef).toEqual({ ref: 3 });
  });

  it('handles null $ attributes', () => {
    const map = parseIfcStep(MINIMAL_STEP);
    const project = map.get(1);
    expect(project).toBeDefined();
    // attr[1] = $ (OwnerHistory) should be null
    expect(project!.attrs[1]).toBeNull();
    // attr[3] = $ (Description) should be null
    expect(project!.attrs[3]).toBeNull();
  });

  it('parses list of refs (#N,#M,...)', () => {
    const step = `ISO-10303-21;
HEADER;
ENDSEC;
DATA;
#10= IFCRELAGGREGATES('guid',$,$,$,#1,(#2,#3,#4));
ENDSEC;
END-ISO-10303-21;`;
    const map = parseIfcStep(step);
    const rel = map.get(10);
    expect(rel).toBeDefined();
    expect(rel!.type).toBe('IFCRELAGGREGATES');
    // attr[6] = list of refs
    // attrs: [0]='guid', [1]=null, [2]=null, [3]=null, [4]={ref:1}, [5]=[refs]
    const list = rel!.attrs[5];
    expect(Array.isArray(list)).toBe(true);
    expect(list).toEqual([{ ref: 2 }, { ref: 3 }, { ref: 4 }]);
  });

  it('ignores lines outside DATA section', () => {
    const step = `ISO-10303-21;
HEADER;
#999= IFCWALL('outside',$,'Outside',$,$,$,$,$);
ENDSEC;
DATA;
#1= IFCWALL('inside',$,'Inside',$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;`;
    const map = parseIfcStep(step);
    expect(map.has(999)).toBe(false);
    expect(map.has(1)).toBe(true);
  });
});
