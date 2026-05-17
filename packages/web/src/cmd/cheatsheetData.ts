import type { TFunction } from 'i18next';

export interface CheatsheetEntry {
  action: string;
  keys: string;
}

export interface CheatsheetSection {
  id: string;
  label: string;
  entries: CheatsheetEntry[];
}

export function getCheatsheetData(t: TFunction): CheatsheetSection[] {
  return [
    {
      id: 'global',
      label: t('cheatsheet.sections.global'),
      entries: [
        { action: t('cheatsheet.actions.commandPalette'), keys: '⌘K / Ctrl+K' },
        { action: t('cheatsheet.actions.showCheatsheet'), keys: '?' },
        { action: t('cheatsheet.actions.cancel'), keys: 'Escape' },
        { action: t('cheatsheet.actions.confirmApply'), keys: 'Enter' },
        { action: t('cheatsheet.actions.saveBundle'), keys: '⌘S' },
        { action: t('cheatsheet.actions.toggleTheme'), keys: '⌘⇧L' },
      ],
    },
    {
      id: 'modes',
      label: t('cheatsheet.sections.modes'),
      entries: [
        { action: t('cheatsheet.actions.modePlan'), keys: '1' },
        { action: t('cheatsheet.actions.mode3d'), keys: '2' },
        { action: t('cheatsheet.actions.modePlan3d'), keys: '3' },
        { action: t('cheatsheet.actions.modeSection'), keys: '4' },
        { action: t('cheatsheet.actions.modeSheet'), keys: '5' },
        { action: t('cheatsheet.actions.modeSchedule'), keys: '6' },
        { action: t('cheatsheet.actions.modeAgent'), keys: '7' },
      ],
    },
    {
      id: 'tools',
      label: t('cheatsheet.sections.tools'),
      entries: [
        { action: t('cheatsheet.actions.toolAreaBoundary'), keys: 'AB' },
        { action: t('cheatsheet.actions.toolArea'), keys: 'AA' },
        { action: t('cheatsheet.actions.toolAttach'), keys: 'AT' },
        { action: t('cheatsheet.actions.toolBeam'), keys: 'BM' },
        { action: t('cheatsheet.actions.toolBeamSystem'), keys: 'BS' },
        { action: t('cheatsheet.actions.toolBrace'), keys: 'BR' },
        { action: t('cheatsheet.actions.toolCableTray'), keys: 'CT' },
        { action: t('cheatsheet.actions.toolCeiling'), keys: 'CL' },
        { action: t('cheatsheet.actions.toolColumn'), keys: 'CO' },
        { action: t('cheatsheet.actions.toolColumnAtGrids'), keys: 'CAG' },
        { action: t('cheatsheet.actions.toolComponent'), keys: 'CC' },
        { action: t('cheatsheet.actions.toolDetach'), keys: 'DT' },
        { action: t('cheatsheet.actions.toolDoor'), keys: 'D' },
        { action: t('cheatsheet.actions.toolDuct'), keys: 'DU' },
        { action: t('cheatsheet.actions.toolElevation'), keys: 'EL' },
        { action: t('cheatsheet.actions.toolEquipment'), keys: 'EQ' },
        { action: t('cheatsheet.actions.toolExcavation'), keys: 'EX' },
        { action: t('cheatsheet.actions.toolFixture'), keys: 'FX' },
        { action: t('cheatsheet.actions.toolFloor'), keys: 'F' },
        { action: t('cheatsheet.actions.toolFloorSketch'), keys: 'Shift+F' },
        { action: t('cheatsheet.actions.toolGrid'), keys: 'GR' },
        { action: t('cheatsheet.actions.toolInteriorElevation'), keys: 'IE' },
        { action: t('cheatsheet.actions.toolMassBox'), keys: 'MBX' },
        { action: t('cheatsheet.actions.toolMassExtrusion'), keys: 'MEX' },
        { action: t('cheatsheet.actions.toolMassRevolution'), keys: 'MRV' },
        { action: t('cheatsheet.actions.toolMaterialTag'), keys: 'MT' },
        { action: t('cheatsheet.actions.toolMaskingRegion'), keys: 'MR' },
        { action: t('cheatsheet.actions.toolMepOpeningRequest'), keys: 'OR' },
        { action: t('cheatsheet.actions.toolMepTerminal'), keys: 'AT' },
        { action: t('cheatsheet.actions.toolModelLine'), keys: 'ML' },
        { action: t('cheatsheet.actions.toolNorthArrow'), keys: 'NA' },
        { action: t('cheatsheet.actions.toolPipe'), keys: 'PI' },
        { action: t('cheatsheet.actions.toolPlaceGroup'), keys: 'PG' },
        { action: t('cheatsheet.actions.toolPlanRegion'), keys: 'PR' },
        { action: t('cheatsheet.actions.toolPropertyLine'), keys: 'PL' },
        { action: t('cheatsheet.actions.toolQuery'), keys: 'Q' },
        { action: t('cheatsheet.actions.toolRailing'), keys: 'Shift+R' },
        { action: t('cheatsheet.actions.toolRamp'), keys: 'RA' },
        { action: t('cheatsheet.actions.toolReferencePlane'), keys: 'RP' },
        { action: t('cheatsheet.actions.toolRevisionCloud'), keys: 'RC' },
        { action: t('cheatsheet.actions.toolRoof'), keys: 'R' },
        { action: t('cheatsheet.actions.toolRoofByExtrusion'), keys: 'RE' },
        { action: t('cheatsheet.actions.toolRoofSketch'), keys: 'Shift+O' },
        { action: t('cheatsheet.actions.toolRoom'), keys: 'M' },
        { action: t('cheatsheet.actions.toolRoomSeparation'), keys: 'RS' },
        { action: t('cheatsheet.actions.toolSection'), keys: 'Shift+S' },
        { action: t('cheatsheet.actions.toolSelect'), keys: 'V' },
        { action: t('cheatsheet.actions.toolShaft'), keys: 'SH' },
        { action: t('cheatsheet.actions.toolSlopeAnnotation'), keys: 'SL' },
        { action: t('cheatsheet.actions.toolSpotCoordinate'), keys: 'SP' },
        { action: t('cheatsheet.actions.toolStair'), keys: 'S' },
        { action: t('cheatsheet.actions.toolTag'), keys: 'T' },
        { action: t('cheatsheet.actions.toolTerrainPad'), keys: 'TPD' },
        { action: t('cheatsheet.actions.toolTerrainPoint'), keys: 'TP' },
        { action: t('cheatsheet.actions.toolToposolidSubdivision'), keys: 'TS' },
        { action: t('cheatsheet.actions.toolUnjoin'), keys: 'UJ' },
        { action: t('cheatsheet.actions.toolWall'), keys: 'W' },
        { action: t('cheatsheet.actions.toolWallJoin'), keys: 'WJ' },
        { action: t('cheatsheet.actions.toolWallOpening'), keys: 'WO' },
        { action: t('cheatsheet.actions.toolWalkthrough'), keys: 'WT' },
        { action: t('cheatsheet.actions.toolWindow'), keys: 'Shift+W' },
      ],
    },
    {
      id: 'modify',
      label: t('cheatsheet.sections.modify'),
      entries: [
        { action: t('cheatsheet.actions.toolMove'), keys: 'MV' },
        { action: t('cheatsheet.actions.toolCopy'), keys: 'CP' },
        { action: t('cheatsheet.actions.toolRotate'), keys: 'RO' },
        { action: t('cheatsheet.actions.toolMirror'), keys: 'MM' },
        { action: t('cheatsheet.actions.toolArray'), keys: 'AR' },
        { action: t('cheatsheet.actions.toolScale'), keys: 'SZ' },
        { action: t('cheatsheet.actions.toolAlign'), keys: 'AL' },
        { action: t('cheatsheet.actions.toolTrim'), keys: 'TR' },
        { action: t('cheatsheet.actions.toolOffset'), keys: 'OF' },
        { action: t('cheatsheet.actions.toolSplit'), keys: 'SL or SD' },
        { action: t('cheatsheet.actions.toolDelete'), keys: 'Del / Backspace' },
        { action: t('cheatsheet.actions.toolPaint'), keys: 'PT' },
        { action: t('cheatsheet.actions.toolSteelConnection'), keys: 'SC' },
      ],
    },
    {
      id: 'annotate',
      label: t('cheatsheet.sections.annotate'),
      entries: [
        { action: t('cheatsheet.actions.toolDimension'), keys: 'Shift+D' },
        { action: t('cheatsheet.actions.toolAngularDim'), keys: 'AD' },
        { action: t('cheatsheet.actions.toolRadialDim'), keys: 'RD' },
        { action: t('cheatsheet.actions.toolDiameterDim'), keys: 'DD' },
        { action: t('cheatsheet.actions.toolArcLengthDim'), keys: 'ALD' },
        { action: t('cheatsheet.actions.toolSpotElevation'), keys: 'SE' },
        { action: t('cheatsheet.actions.toolTextNote'), keys: 'TX' },
        { action: t('cheatsheet.actions.toolLeaderText'), keys: 'LT' },
        { action: t('cheatsheet.actions.toolTag'), keys: 'T' },
        { action: t('cheatsheet.actions.toolMeasure'), keys: 'ME' },
        { action: t('cheatsheet.actions.toolMeasureAngle'), keys: 'MA' },
        { action: t('cheatsheet.actions.toolMeasureArc'), keys: 'MR' },
      ],
    },
    {
      id: 'nav3d',
      label: t('cheatsheet.sections.nav3d'),
      entries: [
        { action: t('cheatsheet.actions.orbit'), keys: 'LMB drag · Alt+LMB' },
        { action: t('cheatsheet.actions.pan'), keys: 'RMB drag · Shift+LMB · MMB drag' },
        { action: t('cheatsheet.actions.zoomInOut'), keys: 'Scroll wheel · Pinch' },
        { action: t('cheatsheet.actions.zoomStep'), keys: '⌘= / ⌘-' },
        { action: t('cheatsheet.actions.fitAll'), keys: 'F' },
        { action: t('cheatsheet.actions.fitSelection'), keys: '⌘F / Ctrl+F' },
        { action: t('cheatsheet.actions.resetView'), keys: 'H · Home' },
        { action: t('cheatsheet.actions.enterWalk'), keys: 'Click Walk button (bottom-left)' },
      ],
    },
    {
      id: 'walk',
      label: t('cheatsheet.sections.walk'),
      entries: [
        { action: t('cheatsheet.actions.moveForwardBack'), keys: 'W / S · ↑ / ↓' },
        { action: t('cheatsheet.actions.strafeLeftRight'), keys: 'A / D · ← / →' },
        { action: t('cheatsheet.actions.ascendDescend'), keys: 'E / Q' },
        { action: t('cheatsheet.actions.run'), keys: 'Shift (hold)' },
        { action: t('cheatsheet.actions.lookAround'), keys: 'Mouse (pointer locked)' },
        { action: t('cheatsheet.actions.jumpFloorAbove'), keys: 'PageUp' },
        { action: t('cheatsheet.actions.jumpFloorBelow'), keys: 'PageDown' },
        { action: t('cheatsheet.actions.exitWalk'), keys: 'Esc' },
      ],
    },
    {
      id: 'nav2d',
      label: t('cheatsheet.sections.nav2d'),
      entries: [
        {
          action: t('cheatsheet.actions.pan'),
          keys: 'LMB drag (empty space) · RMB drag · Space+LMB · MMB',
        },
        { action: t('cheatsheet.actions.zoomInOut'), keys: 'Scroll wheel · Pinch' },
        { action: t('cheatsheet.actions.zoomPresets'), keys: 'Click scale bar (bottom-left)' },
        {
          action: t('cheatsheet.actions.fitToView'),
          keys: 'Shift+F · scale bar → Fit to view',
        },
      ],
    },
    {
      id: 'history',
      label: t('cheatsheet.sections.history'),
      entries: [
        { action: t('cheatsheet.actions.undo'), keys: '⌘Z' },
        { action: t('cheatsheet.actions.redo'), keys: '⇧⌘Z' },
      ],
    },
    {
      id: 'shell',
      label: t('cheatsheet.sections.shell'),
      entries: [
        { action: t('cheatsheet.actions.toggleLeftRail'), keys: '[' },
        { action: t('cheatsheet.actions.toggleRightRail'), keys: ']' },
      ],
    },
  ];
}

export function flattenCheatsheet(t: TFunction): CheatsheetEntry[] {
  return getCheatsheetData(t).flatMap((s) => s.entries);
}

export function filterCheatsheet(query: string, t: TFunction): CheatsheetSection[] {
  const data = getCheatsheetData(t);
  const q = query.trim().toLowerCase();
  if (!q) return data;
  const out: CheatsheetSection[] = [];
  for (const s of data) {
    const entries = s.entries.filter(
      (e) => e.action.toLowerCase().includes(q) || e.keys.toLowerCase().includes(q),
    );
    if (entries.length) out.push({ ...s, entries });
  }
  return out;
}

/** True if a key event should open the cheatsheet — `?` (Shift+/). */
export function shouldOpenCheatsheet(event: { key: string; shiftKey?: boolean }): boolean {
  return event.key === '?' || (event.shiftKey === true && event.key === '/');
}
