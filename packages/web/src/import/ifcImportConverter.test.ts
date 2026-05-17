import { describe, it, expect } from 'vitest';
import { parseIfcStep } from './ifcParser';
import { convertIfcToElements } from './ifcImportConverter';

// Minimal IFC STEP with one wall, one space, one storey
const MINIMAL_IFC = `ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('Test'),'2;1');
ENDSEC;
DATA;
#1= IFCBUILDINGSTOREY('storey-guid',$,'Ground Floor',$,$,$,$,$,.ELEMENT.,0.);
#2= IFCWALLSTANDARDCASE('wall-guid',$,'Wall-1',$,$,$,#10,$);
#3= IFCSPACE('space-guid',$,'Living Room',$,$,$,$,$,.ELEMENT.,$);
#4= IFCRELCONTAINEDINSPATIALSTRUCTURE('rel-guid',$,$,$,(#2,#3),#1);
#10= IFCPRODUCTDEFINITIONSHAPE($,$,(#11));
#11= IFCSHAPEREPRESENTATION(#12,'Body','SweptSolid',(#13));
#12= IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,#14,$);
#13= IFCEXTRUDEDAREASOLID(#15,#16,#17,3.);
#14= IFCAXIS2PLACEMENT3D(#18,$,$);
#15= IFCRECTANGLEPROFILEDEF(.AREA.,$,#19,5.,0.2);
#16= IFCAXIS2PLACEMENT3D(#20,#21,#22);
#17= IFCDIRECTION((0.,0.,1.));
#18= IFCCARTESIANPOINT((0.,0.,0.));
#19= IFCAXIS2PLACEMENT2D(#23,#24);
#20= IFCCARTESIANPOINT((0.,0.,0.));
#21= IFCDIRECTION((0.,0.,1.));
#22= IFCDIRECTION((1.,0.,0.));
#23= IFCCARTESIANPOINT((0.,0.));
#24= IFCDIRECTION((1.,0.));
ENDSEC;
END-ISO-10303-21;`;

// IFC with a floor slab and a door and a window
const IFC_WITH_OPENINGS = `ISO-10303-21;
HEADER;
ENDSEC;
DATA;
#1= IFCBUILDINGSTOREY('s-guid',$,'Level 1',$,$,$,$,$,.ELEMENT.,3.5);
#2= IFCSLAB('slab-guid',$,'Floor Slab',$,$,$,$,$,.FLOOR.);
#3= IFCDOOR('door-guid',$,'Door-1',$,$,$,$,$,2.1,0.9);
#4= IFCWINDOW('win-guid',$,'Window-1',$,$,$,$,$,1.2,1.0);
#5= IFCRELCONTAINEDINSPATIALSTRUCTURE('rel-guid',$,$,$,(#2,#3,#4),#1);
ENDSEC;
END-ISO-10303-21;`;

describe('IFC import converter — §12.1.2', () => {
  it('converts IFCWALL to wall element', () => {
    const entities = parseIfcStep(MINIMAL_IFC);
    const elements = convertIfcToElements(entities);

    const walls = elements.filter((e) => e.kind === 'wall');
    expect(walls.length).toBe(1);

    const wall = walls[0]!;
    expect(wall.kind).toBe('wall');
    expect(wall.id).toBeTruthy();
    // Length extracted from IFCRECTANGLEPROFILEDEF XDim = 5m → 5000mm
    if (wall.kind === 'wall') {
      expect(wall.end.xMm).toBeCloseTo(5000);
      expect(wall.thicknessMm).toBe(200);
      expect(wall.heightMm).toBe(3000);
    }
  });

  it('converts IFCSPACE to room element with name', () => {
    const entities = parseIfcStep(MINIMAL_IFC);
    const elements = convertIfcToElements(entities);

    const rooms = elements.filter((e) => e.kind === 'room');
    expect(rooms.length).toBe(1);

    const room = rooms[0]!;
    expect(room.kind).toBe('room');
    if (room.kind === 'room') {
      expect(room.name).toBe('Living Room');
    }
  });

  it('converts IFCBUILDINGSTOREY to level with elevationMm', () => {
    const entities = parseIfcStep(IFC_WITH_OPENINGS);
    const elements = convertIfcToElements(entities);

    const levels = elements.filter((e) => e.kind === 'level');
    expect(levels.length).toBe(1);

    const level = levels[0]!;
    expect(level.kind).toBe('level');
    if (level.kind === 'level') {
      expect(level.name).toBe('Level 1');
      // Elevation in IFC = 3.5m → 3500mm
      expect(level.elevationMm).toBeCloseTo(3500);
    }
  });

  it('ignores unknown entity types', () => {
    const step = `ISO-10303-21;
HEADER;
ENDSEC;
DATA;
#1= IFCORGANIZATION($,'Org',$,$,$);
#2= IFCAPPLICATION(#1,'1.0','BIM App','bimapp');
ENDSEC;
END-ISO-10303-21;`;
    const entities = parseIfcStep(step);
    const elements = convertIfcToElements(entities);
    // No supported element types; only skip silently
    expect(elements.length).toBe(0);
  });

  it('returns unique ids for each element', () => {
    const step = `ISO-10303-21;
HEADER;
ENDSEC;
DATA;
#1= IFCBUILDINGSTOREY('s1',$,'Level 1',$,$,$,$,$,.ELEMENT.,0.);
#2= IFCBUILDINGSTOREY('s2',$,'Level 2',$,$,$,$,$,.ELEMENT.,3.);
#3= IFCWALL('w1',$,'Wall A',$,$,$,$,$);
#4= IFCWALL('w2',$,'Wall B',$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;`;
    const entities = parseIfcStep(step);
    const elements = convertIfcToElements(entities);
    const ids = elements.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
    expect(ids.length).toBe(4); // 2 levels + 2 walls
  });

  it('converts IFCDOOR with width from shape attrs', () => {
    const entities = parseIfcStep(IFC_WITH_OPENINGS);
    const elements = convertIfcToElements(entities);

    const doors = elements.filter((e) => e.kind === 'door');
    expect(doors.length).toBe(1);

    const door = doors[0]!;
    if (door.kind === 'door') {
      // OverallWidth attr[9] = 0.9m → 900mm
      expect(door.widthMm).toBeCloseTo(900);
    }
  });

  it('converts IFCWINDOW with default dimensions', () => {
    const entities = parseIfcStep(IFC_WITH_OPENINGS);
    const elements = convertIfcToElements(entities);

    const windows = elements.filter((e) => e.kind === 'window');
    expect(windows.length).toBe(1);

    const win = windows[0]!;
    if (win.kind === 'window') {
      // OverallWidth attr[9] = 1.0m → 1000mm
      expect(win.widthMm).toBeCloseTo(1000);
      // OverallHeight attr[8] = 1.2m → 1200mm
      expect(win.heightMm).toBeCloseTo(1200);
    }
  });
});
