/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Element, LensMode } from '@bim-ai/core';

import { fetchSectionProjectionWire } from '../../plan/sectionProjectionWire';
import {
  SECTION_VIEWPORT_ADVISORY_MAX_CHARS,
  SECTION_VIEWPORT_LABEL_FONT_MAX_PX,
  SECTION_VIEWPORT_LABEL_FONT_MIN_PX,
  SECTION_VIEWPORT_LEVEL_SPAN_BRACKET_MARGIN_PX,
  SECTION_VIEWPORT_LEVEL_SPAN_LABEL_MIN_PX,
  SECTION_VIEWPORT_MATERIAL_HINT_MIN_VIEW_PX,
  SECTION_VIEWPORT_OPENING_TAG_MIN_PX,
  SECTION_VIEWPORT_SCALE_BASELINE_PX,
  SECTION_VIEWPORT_STROKE_SCALE_MAX,
  SECTION_VIEWPORT_STROKE_SCALE_MIN,
  SECTION_VIEWPORT_U_SPAN_BRACKET_MARGIN_PX,
  SECTION_VIEWPORT_U_SPAN_LABEL_MIN_PX,
  SECTION_VIEWPORT_WALL_HATCH_ALONG_CUT_TILE,
  SECTION_VIEWPORT_WALL_HATCH_ALONG_STROKE_FACTOR,
  SECTION_VIEWPORT_WALL_HATCH_EDGE_ON_TILE,
} from '../../plan/symbology';
import {
  formatSectionAlongCutSpanMmLabel,
  formatSectionDocMaterialHintCaption,
  formatSectionElevationSpanMmLabel,
  formatSectionLevelDatumCaption,
  formatSectionSheetCalloutsLabel,
  formatSectionStairDocumentationCaption,
  formatSectionWallHatchReadout,
  parseSectionWallCutHatchKind,
  summarizeWallCutHatchKinds,
  type SectionDocMaterialHint,
  type SectionSheetCalloutRow,
  type SectionWallHatchSummary,
} from './sectionViewportDoc';
import { useBimStore } from '../../state/store';
import { lensFilterFromMode } from '../../viewport/useLensFilter';

type UzPrim = {
  id?: string;
  elementId?: string;
  uStartMm: number;
  uEndMm: number;
  zBottomMm: number;
  zTopMm: number;
};

type OpeningPrim = UzPrim & { id: string };

type RoofPrim = {
  id?: string;
  elementId?: string;
  uStartMm: number;
  uEndMm: number;
  zMm: number;
  /** Gable roof: ridge elevation (from gablePitchedRectangleChord proxy). */
  ridgeZMm?: number;
  /** Gable roof: eave plate elevation. */
  eavePlateZMm?: number;
  /** Backend proxy kind, e.g. "gablePitchedRectangleChord". */
  proxyKind?: string;
  /** Direction the ridge runs in plan ("alongX" | "alongZ"). */
  ridgeAxisPlan?: string;
};

type PathPrim = UzPrim & { d: string };

export type SectionLensPrimitiveKind =
  | 'wall'
  | 'floor'
  | 'room'
  | 'stair'
  | 'roof'
  | 'door'
  | 'window';

export type SectionLensPrimitiveStyle = {
  pass: 'foreground' | 'ghost';
  opacity: number;
  stroke?: string;
  fill?: string;
  fillOpacity?: number;
  strokeMultiplier?: number;
  badge?: string;
};

type LevelMarkerPrim = {
  id: string;
  name: string;
  elevationMm: number;
};

const MM_EPS = 0.5;

function formatElevationMmLabel(mm: number): string {
  const m = mm / 1000;
  const sign = m < 0 ? '-' : '+';
  return `${sign}${Math.abs(m).toFixed(3)} m`;
}

function formatLevelDatumLabel(name: string, elevationMm: number): string {
  return `${name} | ${formatElevationMmLabel(elevationMm)}`;
}

function elementRecord(element: Element | undefined): Record<string, unknown> {
  if (!element) return {};
  const out: Record<string, unknown> = { ...(element as unknown as Record<string, unknown>) };
  const props = (element as { props?: unknown }).props;
  if (props && typeof props === 'object' && !Array.isArray(props)) {
    Object.assign(out, props as Record<string, unknown>);
    for (const value of Object.values(props as Record<string, unknown>)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(out, value as Record<string, unknown>);
      }
    }
  }
  return out;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'boolean') return value ? 'yes' : 'no';
  }
  return null;
}

function firstNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function shortBadge(value: string, max = 18): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function lensBadgeForElement(
  lensMode: LensMode,
  element: Element | undefined,
  kind: SectionLensPrimitiveKind,
): string | undefined {
  const record = elementRecord(element);
  switch (lensMode) {
    case 'structure':
      return shortBadge(
        firstString(record, ['structuralRole']) ??
          (record.loadBearing === true ? 'load-bearing' : kind === 'floor' ? 'slab' : kind),
      );
    case 'mep':
      return shortBadge(firstString(record, ['systemId', 'mepSystemId', 'serviceType']) ?? 'MEP');
    case 'fire-safety':
      return shortBadge(
        firstString(record, [
          'fireResistanceRating',
          'fireRating',
          'requiredFireRating',
          'fireCompartmentId',
          'smokeCompartmentId',
        ]) ?? 'fire',
      );
    case 'energy': {
      const uValue = firstNumber(record, ['uValueWPerM2K', 'uValue', 'u_value']);
      if (uValue != null) return `U ${uValue.toFixed(2)}`;
      return shortBadge(
        firstString(record, ['thermalClassification', 'boundaryCondition', 'heatingStatus']) ??
          (kind === 'room' ? 'zone' : 'thermal'),
      );
    }
    case 'sustainability': {
      const gwp = firstNumber(record, ['gwpKgCO2e', 'gwpA1A3KgCO2e', 'carbonKgCO2e']);
      if (gwp != null) return `${Math.round(gwp)} kgCO2e`;
      return shortBadge(firstString(record, ['epdId', 'epdStatus']) ?? 'EPD?');
    }
    case 'cost-quantity':
      return shortBadge(
        firstString(record, ['din276Group', 'costGroup', 'costClassification', 'quantityBasis']) ??
          'QTO',
      );
    case 'construction':
      return shortBadge(
        firstString(record, [
          'phaseCreated',
          'phaseId',
          'constructionPackageId',
          'workPackage',
          'progressStatus',
        ]) ?? 'phase',
      );
    case 'coordination':
      return shortBadge(
        firstString(record, ['reviewStatus', 'bcfTopicId', 'linkedModelId']) ??
          (firstNumber(record, ['issueCount', 'clashCount']) != null ? 'issue' : 'review'),
      );
    default:
      return undefined;
  }
}

export function sectionLensPrimitiveStyle(
  lensMode: LensMode,
  element: Element | undefined,
  kind: SectionLensPrimitiveKind,
): SectionLensPrimitiveStyle {
  if (lensMode === 'all' || lensMode === 'architecture') {
    return { pass: 'foreground', opacity: 1 };
  }
  const pass = element ? lensFilterFromMode(lensMode)(element) : 'foreground';
  if (pass === 'ghost') {
    return {
      pass,
      opacity: 0.2,
      stroke: '#94a3b8',
      fill: '#e2e8f0',
      fillOpacity: 0.16,
      strokeMultiplier: 0.7,
    };
  }

  const badge = lensBadgeForElement(lensMode, element, kind);
  switch (lensMode) {
    case 'structure':
      return { pass, opacity: 1, stroke: '#1d4ed8', strokeMultiplier: 1.35, badge };
    case 'mep':
      return { pass, opacity: 1, stroke: '#0891b2', fill: '#cffafe', fillOpacity: 0.32, badge };
    case 'fire-safety':
      return { pass, opacity: 1, stroke: '#dc2626', fill: '#fee2e2', fillOpacity: 0.35, badge };
    case 'energy':
      return { pass, opacity: 1, stroke: '#d97706', fill: '#fef3c7', fillOpacity: 0.34, badge };
    case 'sustainability':
      return { pass, opacity: 1, stroke: '#16a34a', fill: '#dcfce7', fillOpacity: 0.32, badge };
    case 'cost-quantity':
      return { pass, opacity: 1, stroke: '#7c3aed', fill: '#ede9fe', fillOpacity: 0.3, badge };
    case 'construction':
      return { pass, opacity: 1, stroke: '#ea580c', fill: '#ffedd5', fillOpacity: 0.32, badge };
    case 'coordination':
      return { pass, opacity: 1, stroke: '#2563eb', fill: '#dbeafe', fillOpacity: 0.22, badge };
    default:
      return { pass, opacity: 1 };
  }
}

function sectionAdvisoryFromPayload(payload: Record<string, unknown>): string | null {
  const raw = payload.warnings;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const sym = raw.find(
    (w): w is { code?: string; message?: string } =>
      typeof w === 'object' && w !== null && (w as { code?: string }).code === 'symmetricCropBand',
  );
  const msg =
    (sym?.message && String(sym.message)) ||
    raw
      .map((w) =>
        typeof w === 'object' && w !== null && 'message' in w
          ? String((w as { message?: unknown }).message ?? '')
          : '',
      )
      .filter(Boolean)
      .join(' · ');
  if (!msg) return null;
  const t = msg.trim();
  if (t.length <= SECTION_VIEWPORT_ADVISORY_MAX_CHARS) return t;
  return `${t.slice(0, SECTION_VIEWPORT_ADVISORY_MAX_CHARS - 1)}…`;
}

function viewportDocScale(widthPx: number, heightPx: number): number {
  return Math.min(widthPx, heightPx) / SECTION_VIEWPORT_SCALE_BASELINE_PX;
}

function clampedStrokeScale(widthPx: number, heightPx: number): number {
  const s = viewportDocScale(widthPx, heightPx);
  return Math.min(
    SECTION_VIEWPORT_STROKE_SCALE_MAX,
    Math.max(SECTION_VIEWPORT_STROKE_SCALE_MIN, s),
  );
}

function labelFontPx(widthPx: number, heightPx: number): number {
  const strokeScale = clampedStrokeScale(widthPx, heightPx);
  const base = 11 * strokeScale;
  return Math.min(
    SECTION_VIEWPORT_LABEL_FONT_MAX_PX,
    Math.max(SECTION_VIEWPORT_LABEL_FONT_MIN_PX, base),
  );
}

/** Build pixel-space SVG paths/shapes from `sectionProjectionPrimitives_v1`. */
export function SectionViewportSvg(props: {
  modelId: string;
  sectionCutId: string;
  widthPx: number;
  heightPx: number;
  lensMode?: LensMode;
  /** Optional single-line identity (e.g. from `formatSectionCutIdentityLine`). */
  sectionIdentityCaption?: string;
  /** Optional cut-line / view-heading line (e.g. from `formatSectionCutPlaneContext`). */
  sectionCutPlaneCaption?: string;
  /** Fires after projection resolves; `false` when there are no wall primitives (empty framing). */
  onWallPrimitivesKnown?: (hasWalls: boolean) => void;
}) {
  const [err, setErr] = useState<string | null>(null);
  const elementsById = useBimStore((s) => s.elementsById);
  const lensMode = props.lensMode ?? 'all';

  type LayerSnap = {
    wallPathsEdgeOn: PathPrim[];
    wallPathsAlongCut: PathPrim[];
    floorPaths: PathPrim[];
    roomPaths: PathPrim[];
    stairPaths: PathPrim[];
    roofLines: RoofPrim[];
    doors: OpeningPrim[];
    windows: OpeningPrim[];
    u0: number;
    z0: number;
    z1: number;
    du: number;
    dz: number;
    sx: number;
    sy: number;
    levelMarkers: LevelMarkerPrim[];
    advisory: string | null;
    calloutsCaption: string | null;
    sectionGeomExtent: { uMinMm: number; uMaxMm: number } | null;
    materialHints: SectionDocMaterialHint[];
    wallHatchSummary: SectionWallHatchSummary;
    levelMarkersTotalFromServer: number;
    stairDocCaption: string | null;
    /** Unit tangent of the cut line in plan (from coordinateFrame). */
    cutTangent: [number, number];
  };

  const [layers, setLayers] = useState<LayerSnap | null>(null);

  const defsId = useMemo(
    () => `sec-hatch-${props.sectionCutId.replace(/[^\w]/g, '')}`,
    [props.sectionCutId],
  );

  const strokeScale = clampedStrokeScale(props.widthPx, props.heightPx);
  const lvlPx = labelFontPx(props.widthPx, props.heightPx);
  const openingTagMinPx = SECTION_VIEWPORT_OPENING_TAG_MIN_PX;
  const materialHintMinPx = SECTION_VIEWPORT_MATERIAL_HINT_MIN_VIEW_PX;
  const borderStroke = 3 * strokeScale;
  const patternWallLineEdgeOn = 3.5 * strokeScale;
  const patternWallLineAlongCut =
    patternWallLineEdgeOn * SECTION_VIEWPORT_WALL_HATCH_ALONG_STROKE_FACTOR;
  const patternSlabStroke = 1.25 * strokeScale;
  const floorStroke = 2.25 * strokeScale;
  const stairStroke = 2 * strokeScale;
  const datumStroke = 1.5 * strokeScale;
  const levelLineStroke = 1.1 * strokeScale;
  const wallStroke = 3 * strokeScale;
  const roofStroke = 3 * strokeScale;
  const winStroke = 1 * strokeScale;
  const doorStroke = 1.75 * strokeScale;

  const onWallPrimitivesKnownRef = useRef(props.onWallPrimitivesKnown);
  onWallPrimitivesKnownRef.current = props.onWallPrimitivesKnown;

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const payload = (await fetchSectionProjectionWire(
          props.modelId,
          props.sectionCutId,
        )) as Record<string, unknown>;
        const advisory = sectionAdvisoryFromPayload(payload);
        const coordFrame = payload.coordinateFrame as Record<string, unknown> | undefined;
        const rawTangent = Array.isArray(coordFrame?.cutTangentUnit)
          ? (coordFrame!.cutTangentUnit as unknown[])
          : null;
        const cutTangent: [number, number] = rawTangent
          ? [Number(rawTangent[0] ?? 1), Number(rawTangent[1] ?? 0)]
          : [1, 0];
        const prim = payload.primitives as Record<string, unknown> | undefined;
        const wallsRaw = prim?.walls;
        if (!Array.isArray(wallsRaw) || wallsRaw.length === 0) {
          if (!cancel) {
            setErr(null);
            setLayers(null);
            onWallPrimitivesKnownRef.current?.(false);
          }
          return;
        }

        const wallHatchSummary = summarizeWallCutHatchKinds(
          wallsRaw as ReadonlyArray<{ cutHatchKind?: string }>,
        );

        const levelMarkersRaw = prim?.levelMarkers;
        const allLevelMarkers: LevelMarkerPrim[] = [];
        if (Array.isArray(levelMarkersRaw)) {
          for (const m of levelMarkersRaw as Record<string, unknown>[]) {
            allLevelMarkers.push({
              id: String(m.id ?? ''),
              name: String(m.name ?? m.id ?? ''),
              elevationMm: Number(m.elevationMm ?? 0),
            });
          }
        }
        allLevelMarkers.sort((a, b) => {
          if (a.elevationMm !== b.elevationMm) return a.elevationMm - b.elevationMm;
          return a.id.localeCompare(b.id);
        });
        const levelMarkersTotalFromServer = allLevelMarkers.length;

        const sheetCalloutsRaw = prim?.sheetCallouts;
        const sheetCalloutRows: SectionSheetCalloutRow[] = [];
        if (Array.isArray(sheetCalloutsRaw)) {
          for (const row of sheetCalloutsRaw) {
            if (typeof row !== 'object' || row === null) continue;
            const o = row as Record<string, unknown>;
            const sid = String(o.id ?? '').trim();
            if (!sid) continue;
            sheetCalloutRows.push({ id: sid, name: String(o.name ?? sid) });
          }
        }
        const calloutsCaption =
          sheetCalloutRows.length > 0 ? formatSectionSheetCalloutsLabel(sheetCalloutRows) : null;

        const geomRaw = prim?.sectionGeometryExtentMm;
        let sectionGeomExtent: { uMinMm: number; uMaxMm: number } | null = null;
        if (typeof geomRaw === 'object' && geomRaw !== null) {
          const o = geomRaw as Record<string, unknown>;
          const gu0 = Number(o.uMinMm);
          const gu1 = Number(o.uMaxMm);
          if (Number.isFinite(gu0) && Number.isFinite(gu1) && Math.abs(gu1 - gu0) > MM_EPS) {
            sectionGeomExtent = { uMinMm: gu0, uMaxMm: gu1 };
          }
        }

        const mhRaw = prim?.sectionDocMaterialHints;
        const materialHints: SectionDocMaterialHint[] = [];
        if (Array.isArray(mhRaw)) {
          for (const row of mhRaw as Record<string, unknown>[]) {
            if (typeof row !== 'object' || row === null) continue;
            const o = row as Record<string, unknown>;
            const tid = String(o.tokenId ?? '').trim();
            if (!tid) continue;
            materialHints.push({
              tokenId: tid,
              wallElementId: String(o.wallElementId ?? ''),
              materialLabel: String(o.materialLabel ?? ''),
              materialSurfacePatternId:
                typeof o.materialSurfacePatternId === 'string' ? o.materialSurfacePatternId : null,
              materialCutPatternId:
                typeof o.materialCutPatternId === 'string' ? o.materialCutPatternId : null,
              cutPatternHint: parseSectionWallCutHatchKind(o.cutPatternHint),
              uAnchorMm: Number(o.uAnchorMm ?? 0),
              zAnchorMm: Number(o.zAnchorMm ?? 0),
            });
          }
        }
        materialHints.sort((a, b) => a.tokenId.localeCompare(b.tokenId));

        const asUz = (w: Record<string, unknown>): UzPrim | null => {
          const uStartMm = Number(w.uStartMm ?? 0);
          const uEndMm = Number(w.uEndMm ?? 0);
          const zBottomMm = Number(w.zBottomMm ?? 0);
          const zTopMm = Number(w.zTopMm ?? 0);
          if (![uStartMm, uEndMm, zBottomMm, zTopMm].every(Number.isFinite)) return null;
          return {
            id: typeof w.id === 'string' ? w.id : undefined,
            elementId: typeof w.elementId === 'string' ? w.elementId : undefined,
            uStartMm,
            uEndMm,
            zBottomMm,
            zTopMm,
          };
        };

        const wallRectsEdgeOn: UzPrim[] = [];
        const wallRectsAlongCut: UzPrim[] = [];
        for (const w of wallsRaw as Record<string, unknown>[]) {
          const p = asUz(w);
          if (!p) continue;
          const kind = parseSectionWallCutHatchKind(w.cutHatchKind);
          if (kind === 'edgeOn') wallRectsEdgeOn.push(p);
          else wallRectsAlongCut.push(p);
        }

        const floorRects: UzPrim[] = [];
        const floorsRaw = prim?.floors;
        if (Array.isArray(floorsRaw)) {
          for (const w of floorsRaw as Record<string, unknown>[]) {
            const p = asUz(w);
            if (p) floorRects.push(p);
          }
        }

        const roomRects: UzPrim[] = [];
        const roomsRaw = prim?.rooms;
        if (Array.isArray(roomsRaw)) {
          for (const w of roomsRaw as Record<string, unknown>[]) {
            const p = asUz(w);
            if (p) roomRects.push(p);
          }
        }

        const stairRects: UzPrim[] = [];
        const stairDocSource: Record<string, unknown>[] = [];
        const stairsRaw = prim?.stairs;
        if (Array.isArray(stairsRaw)) {
          for (const w of stairsRaw as Record<string, unknown>[]) {
            stairDocSource.push(w);
            const p = asUz(w);
            if (!p) continue;
            const halfU =
              Number.isFinite(Number(w.widthMm)) && Number(w.widthMm) > 0
                ? Math.abs(Number(w.widthMm)) / 2
                : 0;
            const uLo = Math.min(p.uStartMm, p.uEndMm) - halfU;
            const uHi = Math.max(p.uStartMm, p.uEndMm) + halfU;
            stairRects.push({ ...p, uStartMm: uLo, uEndMm: uHi });
          }
        }
        const stairDocCaption = formatSectionStairDocumentationCaption(stairDocSource);

        const roofLines: RoofPrim[] = [];
        const roofsRaw = prim?.roofs;
        if (Array.isArray(roofsRaw)) {
          for (const w of roofsRaw as Record<string, unknown>[]) {
            const ridgeZRaw = Number(w.ridgeZMm);
            const eavePlateZRaw = Number(w.eavePlateZMm);
            roofLines.push({
              id: typeof w.id === 'string' ? w.id : undefined,
              elementId: typeof w.elementId === 'string' ? w.elementId : undefined,
              uStartMm: Number(w.uStartMm ?? 0),
              uEndMm: Number(w.uEndMm ?? 0),
              zMm: Number(w.zMidMm ?? w.z_mid_mm ?? w.zMm ?? 0),
              ridgeZMm: Number.isFinite(ridgeZRaw) ? ridgeZRaw : undefined,
              eavePlateZMm: Number.isFinite(eavePlateZRaw) ? eavePlateZRaw : undefined,
              proxyKind: typeof w.proxyKind === 'string' ? w.proxyKind : undefined,
              ridgeAxisPlan: typeof w.ridgeAxisPlan === 'string' ? w.ridgeAxisPlan : undefined,
            });
          }
        }

        let u0 = Infinity;
        let u1 = -Infinity;
        let z0 = Infinity;
        let z1 = -Infinity;

        const widen = (...arr: UzPrim[]) => {
          for (const r of arr) {
            u0 = Math.min(u0, r.uStartMm, r.uEndMm);
            u1 = Math.max(u1, r.uStartMm, r.uEndMm);
            z0 = Math.min(z0, r.zBottomMm, r.zTopMm);
            z1 = Math.max(z1, r.zBottomMm, r.zTopMm);
          }
        };

        widen(...wallRectsEdgeOn, ...wallRectsAlongCut);
        widen(...floorRects);
        widen(...roomRects);
        widen(...stairRects);

        for (const r of roofLines) {
          u0 = Math.min(u0, r.uStartMm, r.uEndMm);
          u1 = Math.max(u1, r.uStartMm, r.uEndMm);
          const rZLow = r.eavePlateZMm ?? r.zMm;
          const rZHigh = r.ridgeZMm ?? r.zMm;
          z0 = Math.min(z0, rZLow, rZHigh);
          z1 = Math.max(z1, rZLow, rZHigh);
        }

        const doorsOpen: OpeningPrim[] = [];
        const doorsRaw = prim?.doors;
        if (Array.isArray(doorsRaw)) {
          for (const w of doorsRaw as Record<string, unknown>[]) {
            const uC = Number(w.uCenterMm ?? 0);
            const half = Number(w.openingHalfWidthAlongUMm ?? 0);
            const zb = Number(w.zBottomMm ?? 0);
            const zt = Number(w.zTopMm ?? 0);
            doorsOpen.push({
              id: String(w.id ?? 'door'),
              elementId: typeof w.elementId === 'string' ? w.elementId : undefined,
              uStartMm: uC - Math.abs(half),
              uEndMm: uC + Math.abs(half),
              zBottomMm: zb,
              zTopMm: zt,
            });
            u0 = Math.min(u0, doorsOpen.at(-1)!.uStartMm);
            u1 = Math.max(u1, doorsOpen.at(-1)!.uEndMm);
            z0 = Math.min(z0, zb, zt);
            z1 = Math.max(z1, zb, zt);
          }
        }

        const windowsOpen: OpeningPrim[] = [];
        const windowsRaw = prim?.windows;
        if (Array.isArray(windowsRaw)) {
          for (const w of windowsRaw as Record<string, unknown>[]) {
            const uC = Number(w.uCenterMm ?? 0);
            const half = Number(w.openingHalfWidthAlongUMm ?? 0);
            const zb = Number(w.zBottomMm ?? 0);
            const zt = Number(w.zTopMm ?? 0);
            windowsOpen.push({
              id: String(w.id ?? 'window'),
              elementId: typeof w.elementId === 'string' ? w.elementId : undefined,
              uStartMm: uC - Math.abs(half),
              uEndMm: uC + Math.abs(half),
              zBottomMm: zb,
              zTopMm: zt,
            });
            u0 = Math.min(u0, windowsOpen.at(-1)!.uStartMm);
            u1 = Math.max(u1, windowsOpen.at(-1)!.uEndMm);
            z0 = Math.min(z0, zb, zt);
            z1 = Math.max(z1, zb, zt);
          }
        }

        const padU = Math.max(800, (u1 - u0) * 0.08);
        const padZ = Math.max(400, (z1 - z0) * 0.1);

        u0 -= padU;
        u1 += padU;
        z0 -= padZ;
        z1 += padZ;

        const levelMarkersInView = allLevelMarkers.filter(
          (m) => m.elevationMm >= z0 - MM_EPS && m.elevationMm <= z1 + MM_EPS,
        );

        const du = Math.max(u1 - u0, 1);
        const dz = Math.max(z1 - z0, 1);
        const sx = props.widthPx / du;
        const sy = props.heightPx / dz;

        const rectPath = (r: UzPrim): PathPrim => {
          const x = (Math.min(r.uStartMm, r.uEndMm) - u0) * sx;
          const bw = Math.abs(r.uEndMm - r.uStartMm) * sx;
          const yTop = (z1 - Math.max(r.zBottomMm, r.zTopMm)) * sy;
          const h = Math.abs(r.zTopMm - r.zBottomMm) * sy;
          return { ...r, d: `M ${x} ${yTop} h ${bw} v ${h} h ${-bw} Z` };
        };

        const wallPathsEdgeOn = wallRectsEdgeOn.map(rectPath);
        const wallPathsAlongCut = wallRectsAlongCut.map(rectPath);
        const floorPaths = floorRects.map(rectPath);
        const roomPaths = roomRects.map(rectPath);
        const stairPaths = stairRects.map(rectPath);

        if (!cancel) {
          setErr(null);
          onWallPrimitivesKnownRef.current?.(true);
          setLayers({
            wallPathsEdgeOn,
            wallPathsAlongCut,
            floorPaths,
            roomPaths,
            stairPaths,
            roofLines,
            doors: doorsOpen,
            windows: windowsOpen,
            u0,
            z0,
            z1,
            du,
            dz,
            sx,
            sy,
            levelMarkers: levelMarkersInView,
            advisory,
            calloutsCaption,
            sectionGeomExtent,
            materialHints,
            wallHatchSummary,
            levelMarkersTotalFromServer,
            stairDocCaption,
            cutTangent,
          });
        }
      } catch (e) {
        if (!cancel) {
          setErr(e instanceof Error ? e.message : String(e));
          setLayers(null);
          onWallPrimitivesKnownRef.current?.(false);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [props.modelId, props.sectionCutId, props.widthPx, props.heightPx]);

  const vb = `0 0 ${props.widthPx} ${props.heightPx}`;

  const topDocFontPx = Math.max(8, 9 * strokeScale);
  const topDocLineStepPx = Math.max(11, 12 * strokeScale);
  const topDocRows = useMemo(() => {
    const rows: { key: string; text: string; testId?: string }[] = [];
    if (props.sectionIdentityCaption) {
      rows.push({
        key: 'sec-ident',
        text: props.sectionIdentityCaption,
        testId: 'section-cut-identity-caption',
      });
    }
    if (props.sectionCutPlaneCaption) {
      rows.push({
        key: 'sec-plane',
        text: props.sectionCutPlaneCaption,
        testId: 'section-cut-plane-caption',
      });
    }
    if (layers) {
      rows.push({
        key: 'wall-hatch',
        text: formatSectionWallHatchReadout(layers.wallHatchSummary),
        testId: 'section-wall-hatch-readout',
      });
      const lvl = formatSectionLevelDatumCaption({
        inViewCount: layers.levelMarkers.length,
        totalFromServer: layers.levelMarkersTotalFromServer,
      });
      if (lvl) {
        rows.push({ key: 'lvl-datum', text: lvl, testId: 'section-level-datum-caption' });
      }
      if (layers.stairDocCaption) {
        rows.push({
          key: 'stair-doc',
          text: layers.stairDocCaption,
          testId: 'section-stair-doc-caption',
        });
      }
    }
    return rows;
  }, [layers, props.sectionCutPlaneCaption, props.sectionIdentityCaption]);

  /**
   * For a gable roof, determine whether this section cut is perpendicular to the ridge
   * (cross-section → show gable triangle) or parallel (longitudinal → show chord line).
   */
  function isGableCrossSection(r: RoofPrim, ct: [number, number]): boolean {
    if (r.proxyKind !== 'gablePitchedRectangleChord') return false;
    const absTx = Math.abs(ct[0]);
    const absTy = Math.abs(ct[1]);
    if (r.ridgeAxisPlan === 'alongZ') return absTx > absTy;
    if (r.ridgeAxisPlan === 'alongX') return absTy > absTx;
    return false;
  }

  type RoofRenderKind =
    | {
        kind: 'triangle';
        path: string;
        xL: number;
        xMid: number;
        xR: number;
        yEave: number;
        yRidge: number;
      }
    | { kind: 'chord'; path: string; xC: number; yC: number };

  const roofRenderItems: RoofRenderKind[] = layers
    ? layers.roofLines.map((r) => {
        const uL = Math.min(r.uStartMm, r.uEndMm);
        const uR = Math.max(r.uStartMm, r.uEndMm);
        const xL = (uL - layers.u0) * layers.sx;
        const xR = (uR - layers.u0) * layers.sx;
        if (
          isGableCrossSection(r, layers.cutTangent) &&
          r.ridgeZMm != null &&
          r.eavePlateZMm != null
        ) {
          const xMid = 0.5 * (xL + xR);
          const yEave = (layers.z1 - r.eavePlateZMm) * layers.sy;
          const yRidge = (layers.z1 - r.ridgeZMm) * layers.sy;
          return {
            kind: 'triangle',
            path: `M ${xL} ${yEave} L ${xMid} ${yRidge} L ${xR} ${yEave} Z`,
            xL,
            xMid,
            xR,
            yEave,
            yRidge,
          };
        }
        const y = (layers.z1 - r.zMm) * layers.sy;
        return { kind: 'chord', path: `M ${xL} ${y} L ${xR} ${y}`, xC: 0.5 * (xL + xR), yC: y };
      })
    : [];

  const openingPx = (L: LayerSnap, o: UzPrim) => {
    const x = (Math.min(o.uStartMm, o.uEndMm) - L.u0) * L.sx;
    const bw = Math.abs(o.uEndMm - o.uStartMm) * L.sx;
    const yTop = (L.z1 - Math.max(o.zBottomMm, o.zTopMm)) * L.sy;
    const h = Math.abs(o.zTopMm - o.zBottomMm) * L.sy;
    return { x, y: yTop, w: bw, h };
  };

  const primitiveCenterPx = (L: LayerSnap, o: UzPrim) => {
    const b = openingPx(L, o);
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  };

  const elementForPrimitive = (p: { elementId?: string } | undefined): Element | undefined =>
    p?.elementId ? elementsById[p.elementId] : undefined;

  const lensBadge = (key: string, style: SectionLensPrimitiveStyle, x: number, y: number) => {
    if (lensMode === 'all' || !style.badge || style.pass === 'ghost') return null;
    const fontSize = Math.max(7, 8.5 * strokeScale);
    const padX = 4 * strokeScale;
    const width = Math.min(
      150 * strokeScale,
      Math.max(24 * strokeScale, style.badge.length * fontSize * 0.58 + padX * 2),
    );
    const height = Math.max(13, 14 * strokeScale);
    return (
      <g key={`${key}-lens-badge`} data-testid="section-lens-badge" pointerEvents="none">
        <rect
          x={x - width / 2}
          y={y - height / 2}
          width={width}
          height={height}
          rx={3 * strokeScale}
          fill="#ffffff"
          fillOpacity={0.86}
          stroke={style.stroke ?? '#475569'}
          strokeWidth={0.8 * strokeScale}
        />
        <text
          x={x}
          y={y}
          textAnchor="middle"
          dominantBaseline="central"
          fill={style.stroke ?? '#334155'}
          style={{ fontSize, fontWeight: 700 }}
        >
          {style.badge}
        </text>
      </g>
    );
  };

  const datumShown = layers ? layers.z0 <= 0 && 0 <= layers.z1 : false;

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={vb}
      preserveAspectRatio="xMidYMid meet"
      className="block size-full max-h-full max-w-full"
    >
      <defs>
        <pattern
          id={`${defsId}-wall-edgeOn`}
          width={SECTION_VIEWPORT_WALL_HATCH_EDGE_ON_TILE}
          height={SECTION_VIEWPORT_WALL_HATCH_EDGE_ON_TILE}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={SECTION_VIEWPORT_WALL_HATCH_EDGE_ON_TILE}
            stroke="#334155"
            strokeWidth={patternWallLineEdgeOn}
          />
        </pattern>

        <pattern
          id={`${defsId}-wall-alongCut`}
          width={SECTION_VIEWPORT_WALL_HATCH_ALONG_CUT_TILE}
          height={SECTION_VIEWPORT_WALL_HATCH_ALONG_CUT_TILE}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-45)"
        >
          <line
            x1={0}
            y1={0}
            x2={0}
            y2={SECTION_VIEWPORT_WALL_HATCH_ALONG_CUT_TILE}
            stroke="#475569"
            strokeWidth={patternWallLineAlongCut}
          />
        </pattern>

        <pattern id={`${defsId}-slab`} width={14} height={14} patternUnits="userSpaceOnUse">
          <rect width={14} height={14} fill="#fff7ed" />
          <path
            d="M0 14 L14 0"
            stroke="#b45309"
            strokeOpacity={0.45}
            strokeWidth={patternSlabStroke}
          />
        </pattern>
      </defs>

      <rect
        width={props.widthPx}
        height={props.heightPx}
        fill="#fafafa"
        stroke="#cbd5e1"
        strokeWidth={borderStroke}
      />

      {layers ? (
        <>
          {layers.roomPaths.map((p, i) => {
            const style = sectionLensPrimitiveStyle(lensMode, elementForPrimitive(p), 'room');
            const c = primitiveCenterPx(layers, p);
            return (
              <g key={`room-${i}`} opacity={style.opacity} data-section-lens-pass={style.pass}>
                <path
                  d={p.d}
                  fill={style.fill ?? '#c7d2fe'}
                  fillOpacity={style.fillOpacity ?? 0.22}
                  stroke={style.stroke ?? 'none'}
                  strokeWidth={style.stroke ? 1.5 * strokeScale : 0}
                />
                {lensBadge(`room-${i}`, style, c.x, c.y)}
              </g>
            );
          })}

          {layers.floorPaths.map((p, i) => {
            const style = sectionLensPrimitiveStyle(lensMode, elementForPrimitive(p), 'floor');
            const c = primitiveCenterPx(layers, p);
            return (
              <g key={`floor-${i}`} opacity={style.opacity} data-section-lens-pass={style.pass}>
                <path
                  d={p.d}
                  fill={style.fill ?? `url(#${defsId}-slab)`}
                  fillOpacity={style.fillOpacity}
                  stroke={style.stroke ?? '#92400e'}
                  strokeOpacity={0.65}
                  strokeWidth={floorStroke * (style.strokeMultiplier ?? 1)}
                />
                {lensBadge(`floor-${i}`, style, c.x, c.y)}
              </g>
            );
          })}
          {layers.stairPaths.map((p, i) => {
            const style = sectionLensPrimitiveStyle(lensMode, elementForPrimitive(p), 'stair');
            const c = primitiveCenterPx(layers, p);
            return (
              <g key={`stair-${i}`} opacity={style.opacity} data-section-lens-pass={style.pass}>
                <path
                  d={p.d}
                  fill={style.fill ?? '#fde68a'}
                  fillOpacity={style.fillOpacity ?? 0.75}
                  stroke={style.stroke ?? '#b45309'}
                  strokeWidth={stairStroke * (style.strokeMultiplier ?? 1)}
                />
                {lensBadge(`stair-${i}`, style, c.x, c.y)}
              </g>
            );
          })}

          {datumShown ? (
            <line
              key="datum-z0"
              x1={0}
              x2={props.widthPx}
              y1={(layers.z1 - 0) * layers.sy}
              y2={(layers.z1 - 0) * layers.sy}
              stroke="#475569"
              strokeWidth={datumStroke}
              strokeDasharray={`${6 * strokeScale} ${5 * strokeScale}`}
              opacity={0.9}
            />
          ) : null}

          {layers.levelMarkers.map((m) => {
            const skipLine = datumShown && Math.abs(m.elevationMm) < MM_EPS;
            if (skipLine) return null;
            const y = (layers.z1 - m.elevationMm) * layers.sy;
            if (y < -2 || y > props.heightPx + 2) return null;
            const headR = 4 * strokeScale;
            const headX = props.widthPx - headR - 2;
            return (
              <g key={`lvl-datum-${m.id}`}>
                <line
                  x1={0}
                  x2={headX}
                  y1={y}
                  y2={y}
                  stroke="#3b82f6"
                  strokeWidth={levelLineStroke}
                  strokeDasharray={`${8 * strokeScale} ${5 * strokeScale}`}
                  opacity={0.7}
                />
                <circle
                  cx={headX}
                  cy={y}
                  r={headR}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth={levelLineStroke}
                  opacity={0.85}
                />
              </g>
            );
          })}

          {layers.wallPathsEdgeOn.map((p, i) => {
            const style = sectionLensPrimitiveStyle(lensMode, elementForPrimitive(p), 'wall');
            const c = primitiveCenterPx(layers, p);
            return (
              <g key={`wall-e-${i}`} opacity={style.opacity} data-section-lens-pass={style.pass}>
                <path
                  d={p.d}
                  fill={style.fill ?? `url(#${defsId}-wall-edgeOn)`}
                  fillOpacity={style.fillOpacity ?? 0.92}
                  stroke={style.stroke ?? '#020617'}
                  strokeWidth={wallStroke * (style.strokeMultiplier ?? 1)}
                />
                {lensBadge(`wall-e-${i}`, style, c.x, c.y)}
              </g>
            );
          })}
          {layers.wallPathsAlongCut.map((p, i) => {
            const style = sectionLensPrimitiveStyle(lensMode, elementForPrimitive(p), 'wall');
            const c = primitiveCenterPx(layers, p);
            return (
              <g key={`wall-a-${i}`} opacity={style.opacity} data-section-lens-pass={style.pass}>
                <path
                  d={p.d}
                  fill={style.fill ?? `url(#${defsId}-wall-alongCut)`}
                  fillOpacity={style.fillOpacity ?? 0.9}
                  stroke={style.stroke ?? '#020617'}
                  strokeWidth={wallStroke * (style.strokeMultiplier ?? 1)}
                />
                {lensBadge(`wall-a-${i}`, style, c.x, c.y)}
              </g>
            );
          })}

          {Math.min(props.widthPx, props.heightPx) >= materialHintMinPx
            ? layers.materialHints.map((h) => {
                const x = (h.uAnchorMm - layers.u0) * layers.sx;
                const y = (layers.z1 - h.zAnchorMm) * layers.sy;
                return (
                  <text
                    key={`mh-${h.tokenId}`}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#3730a3"
                    data-section-doc-token={h.tokenId}
                    style={{
                      fontSize: Math.max(7, 8.5 * strokeScale),
                      fontWeight: 500,
                    }}
                    pointerEvents="none"
                  >
                    {formatSectionDocMaterialHintCaption(h)}
                  </text>
                );
              })
            : null}

          {roofRenderItems.map((item, i) => {
            const roof = layers.roofLines[i];
            const style = sectionLensPrimitiveStyle(lensMode, elementForPrimitive(roof), 'roof');
            if (item.kind === 'triangle') {
              const badgeX = item.xMid;
              const badgeY = item.yRidge - 10 * strokeScale;
              return (
                <g key={`roof-${i}`} opacity={style.opacity} data-section-lens-pass={style.pass}>
                  <path
                    d={item.path}
                    fill={style.fill ?? '#f0fdf4'}
                    fillOpacity={style.fillOpacity ?? 0.55}
                    stroke={style.stroke ?? '#065f46'}
                    strokeWidth={roofStroke * (style.strokeMultiplier ?? 1)}
                    strokeLinejoin="round"
                  />
                  {lensBadge(`roof-${i}`, style, badgeX, badgeY)}
                </g>
              );
            }
            return (
              <g key={`roof-${i}`} opacity={style.opacity} data-section-lens-pass={style.pass}>
                <path
                  d={item.path}
                  fill="none"
                  stroke={style.stroke ?? '#065f46'}
                  strokeWidth={roofStroke * (style.strokeMultiplier ?? 1)}
                  strokeDasharray={`${6 * strokeScale} ${10 * strokeScale}`}
                />
                {lensBadge(`roof-${i}`, style, item.xC, item.yC - 10 * strokeScale)}
              </g>
            );
          })}
          {layers.windows.map((w, i) => {
            const b = openingPx(layers, w);
            const showTag = Math.min(b.w, b.h) >= openingTagMinPx;
            const style = sectionLensPrimitiveStyle(lensMode, elementForPrimitive(w), 'window');
            return (
              <g
                key={`win-${w.id}-${i}`}
                opacity={style.opacity}
                data-section-lens-pass={style.pass}
              >
                <rect
                  x={b.x + 2}
                  y={b.y + 2}
                  width={Math.max(0, b.w - 4)}
                  height={Math.max(0, b.h - 4)}
                  fill={style.fill ?? '#ecfdf5'}
                  fillOpacity={style.fillOpacity}
                  stroke={style.stroke ?? '#047857'}
                  strokeWidth={winStroke * (style.strokeMultiplier ?? 1)}
                  strokeDasharray={`${6 * strokeScale} ${6 * strokeScale}`}
                />
                {showTag ? (
                  <text
                    x={b.x + b.w / 2}
                    y={b.y + b.h / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#065f46"
                    style={{ fontSize: Math.max(8, 10 * strokeScale), fontWeight: 600 }}
                    pointerEvents="none"
                  >
                    W
                  </text>
                ) : null}
                {lensBadge(`win-${w.id}-${i}`, style, b.x + b.w / 2, b.y + b.h / 2)}
              </g>
            );
          })}

          {layers.doors.map((w, i) => {
            const b = openingPx(layers, w);
            const showTag = Math.min(b.w, b.h) >= openingTagMinPx;
            const style = sectionLensPrimitiveStyle(lensMode, elementForPrimitive(w), 'door');
            return (
              <g
                key={`dor-${w.id}-${i}`}
                opacity={style.opacity}
                data-section-lens-pass={style.pass}
              >
                <rect
                  x={b.x + 2}
                  y={b.y + 2}
                  width={Math.max(0, b.w - 4)}
                  height={Math.max(0, b.h - 4)}
                  fill={style.fill ?? '#fefefe'}
                  fillOpacity={style.fillOpacity}
                  stroke={style.stroke ?? '#1f2937'}
                  strokeWidth={doorStroke * (style.strokeMultiplier ?? 1)}
                />
                {showTag ? (
                  <text
                    x={b.x + b.w / 2}
                    y={b.y + b.h / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#1f2937"
                    style={{ fontSize: Math.max(8, 10 * strokeScale), fontWeight: 600 }}
                    pointerEvents="none"
                  >
                    D
                  </text>
                ) : null}
                {lensBadge(`dor-${w.id}-${i}`, style, b.x + b.w / 2, b.y + b.h / 2)}
              </g>
            );
          })}

          {layers.levelMarkers.map((m) => {
            const y = (layers.z1 - m.elevationMm) * layers.sy;
            if (y < -4 || y > props.heightPx + 4) return null;
            return (
              <text
                key={`lvl-txt-${m.id}`}
                x={8}
                y={y - 3}
                fill="#1d4ed8"
                style={{ fontSize: lvlPx, fontWeight: 500 }}
                dominantBaseline="auto"
              >
                {formatLevelDatumLabel(m.name, m.elevationMm)}
              </text>
            );
          })}
          {(() => {
            const mk = layers.levelMarkers;
            if (mk.length < 2) return null;
            const elevs = mk.map((m) => m.elevationMm);
            const zLo = Math.min(...elevs);
            const zHi = Math.max(...elevs);
            if (Math.abs(zHi - zLo) < MM_EPS) return null;
            const bracketX = props.widthPx - SECTION_VIEWPORT_LEVEL_SPAN_BRACKET_MARGIN_PX;
            const tick = 14 * strokeScale;
            const yTop = (layers.z1 - zHi) * layers.sy;
            const yBot = (layers.z1 - zLo) * layers.sy;
            const yA = Math.min(yTop, yBot);
            const yB = Math.max(yTop, yBot);
            if (yB < -8 || yA > props.heightPx + 8) return null;
            const lbl = formatSectionElevationSpanMmLabel(zLo, zHi);
            const midY = 0.5 * (yA + yB);
            const lvlSpanFont = Math.max(
              SECTION_VIEWPORT_LEVEL_SPAN_LABEL_MIN_PX,
              10 * strokeScale,
            );
            return (
              <g key="lvl-span-bracket">
                <line
                  x1={bracketX}
                  x2={bracketX}
                  y1={yA}
                  y2={yB}
                  stroke="#475569"
                  strokeWidth={datumStroke}
                />
                <line
                  x1={bracketX - tick}
                  x2={bracketX}
                  y1={yA}
                  y2={yA}
                  stroke="#475569"
                  strokeWidth={datumStroke}
                />
                <line
                  x1={bracketX - tick}
                  x2={bracketX}
                  y1={yB}
                  y2={yB}
                  stroke="#475569"
                  strokeWidth={datumStroke}
                />
                <text
                  x={bracketX - tick - 6}
                  y={midY}
                  fill="#334155"
                  textAnchor="end"
                  dominantBaseline="middle"
                  style={{ fontSize: lvlSpanFont }}
                  pointerEvents="none"
                >
                  {lbl}
                </text>
              </g>
            );
          })()}
          {(() => {
            const g = layers.sectionGeomExtent;
            if (!g) return null;
            const span = Math.abs(g.uMaxMm - g.uMinMm);
            if (span < MM_EPS) return null;
            const bracketY = props.heightPx - SECTION_VIEWPORT_U_SPAN_BRACKET_MARGIN_PX;
            const tick = 14 * strokeScale;
            const xA = (Math.min(g.uMinMm, g.uMaxMm) - layers.u0) * layers.sx;
            const xB = (Math.max(g.uMinMm, g.uMaxMm) - layers.u0) * layers.sx;
            const xLeft = Math.min(xA, xB);
            const xRight = Math.max(xA, xB);
            if (xRight < -8 || xLeft > props.widthPx + 8) return null;
            const lbl = formatSectionAlongCutSpanMmLabel(g.uMinMm, g.uMaxMm);
            const midX = 0.5 * (xLeft + xRight);
            const uSpanFont = Math.max(SECTION_VIEWPORT_U_SPAN_LABEL_MIN_PX, 10 * strokeScale);
            return (
              <g key="u-span-bracket">
                <line
                  x1={xLeft}
                  x2={xRight}
                  y1={bracketY}
                  y2={bracketY}
                  stroke="#475569"
                  strokeWidth={datumStroke}
                />
                <line
                  x1={xLeft}
                  x2={xLeft}
                  y1={bracketY}
                  y2={bracketY - tick}
                  stroke="#475569"
                  strokeWidth={datumStroke}
                />
                <line
                  x1={xRight}
                  x2={xRight}
                  y1={bracketY}
                  y2={bracketY - tick}
                  stroke="#475569"
                  strokeWidth={datumStroke}
                />
                <text
                  x={midX}
                  y={bracketY - tick - 6}
                  fill="#334155"
                  textAnchor="middle"
                  dominantBaseline="auto"
                  style={{ fontSize: uSpanFont }}
                  pointerEvents="none"
                >
                  {lbl}
                </text>
              </g>
            );
          })()}
        </>
      ) : null}
      {layers?.calloutsCaption ? (
        <text
          x={8}
          y={props.heightPx - 8}
          fill="#64748b"
          textAnchor="start"
          dominantBaseline="auto"
          style={{ fontSize: Math.max(8, 9 * strokeScale) }}
          pointerEvents="none"
        >
          {layers.calloutsCaption}
        </text>
      ) : null}
      {layers?.advisory ? (
        <text
          x={props.widthPx - 8}
          y={props.heightPx - 8}
          fill="#64748b"
          textAnchor="end"
          dominantBaseline="auto"
          style={{ fontSize: Math.max(8, 9 * strokeScale) }}
        >
          {layers.advisory}
        </text>
      ) : null}
      {topDocRows.map((row, i) => (
        <text
          key={row.key}
          x={8}
          y={10 + i * topDocLineStepPx}
          fill="#334155"
          dominantBaseline="hanging"
          style={{ fontSize: topDocFontPx }}
          pointerEvents="none"
          data-testid={row.testId}
        >
          {row.text}
        </text>
      ))}
      {err ? (
        <text
          x={8}
          y={10 + topDocRows.length * topDocLineStepPx + 6}
          fill="#b45309"
          dominantBaseline="hanging"
          style={{ fontSize: 10 }}
        >
          {err}
        </text>
      ) : null}
    </svg>
  );
}
