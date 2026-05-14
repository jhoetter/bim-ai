/* eslint-disable bim-ai/no-hex-in-chrome -- pre-v3 hex literals; remove when this file is migrated in B4 Phase 2 */
import { useEffect, useMemo, useRef, useState } from 'react';

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

type UzPrim = {
  uStartMm: number;
  uEndMm: number;
  zBottomMm: number;
  zTopMm: number;
};

type OpeningPrim = UzPrim & { id: string };

type RoofPrim = {
  uStartMm: number;
  uEndMm: number;
  zMm: number;
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
  /** Optional single-line identity (e.g. from `formatSectionCutIdentityLine`). */
  sectionIdentityCaption?: string;
  /** Optional cut-line / view-heading line (e.g. from `formatSectionCutPlaneContext`). */
  sectionCutPlaneCaption?: string;
  /** Fires after projection resolves; `false` when there are no wall primitives (empty framing). */
  onWallPrimitivesKnown?: (hasWalls: boolean) => void;
}) {
  const [err, setErr] = useState<string | null>(null);

  type LayerSnap = {
    wallPathsEdgeOn: string[];
    wallPathsAlongCut: string[];
    floorPaths: string[];
    roomPaths: string[];
    stairPaths: string[];
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

        const asUz = (w: Record<string, unknown>): UzPrim | null => ({
          uStartMm: Number(w.uStartMm ?? 0),
          uEndMm: Number(w.uEndMm ?? 0),
          zBottomMm: Number(w.zBottomMm ?? 0),
          zTopMm: Number(w.zTopMm ?? 0),
        });

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
            roofLines.push({
              uStartMm: Number(w.uStartMm ?? 0),
              uEndMm: Number(w.uEndMm ?? 0),
              zMm: Number(w.zMidMm ?? w.z_mid_mm ?? w.zMm ?? 0),
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
          z0 = Math.min(z0, r.zMm);
          z1 = Math.max(z1, r.zMm);
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

        const rectPath = (r: UzPrim) => {
          const x = (Math.min(r.uStartMm, r.uEndMm) - u0) * sx;
          const bw = Math.abs(r.uEndMm - r.uStartMm) * sx;
          const yTop = (z1 - Math.max(r.zBottomMm, r.zTopMm)) * sy;
          const h = Math.abs(r.zTopMm - r.zBottomMm) * sy;
          return `M ${x} ${yTop} h ${bw} v ${h} h ${-bw} Z`;
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

  const roofChordPath = layers
    ? layers.roofLines.map((r) => {
        const x0 = (Math.min(r.uStartMm, r.uEndMm) - layers.u0) * layers.sx;
        const x1 = (Math.max(r.uStartMm, r.uEndMm) - layers.u0) * layers.sx;
        const y = (layers.z1 - r.zMm) * layers.sy;
        return `M ${x0} ${y} L ${x1} ${y}`;
      })
    : [];

  const openingPx = (L: LayerSnap, o: UzPrim) => {
    const x = (Math.min(o.uStartMm, o.uEndMm) - L.u0) * L.sx;
    const bw = Math.abs(o.uEndMm - o.uStartMm) * L.sx;
    const yTop = (L.z1 - Math.max(o.zBottomMm, o.zTopMm)) * L.sy;
    const h = Math.abs(o.zTopMm - o.zBottomMm) * L.sy;
    return { x, y: yTop, w: bw, h };
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
          {layers.roomPaths.map((d, i) => (
            <path key={`room-${i}`} d={d} fill="#c7d2fe" fillOpacity={0.22} stroke="none" />
          ))}

          {layers.floorPaths.map((d, i) => (
            <path
              key={`floor-${i}`}
              d={d}
              fill={`url(#${defsId}-slab)`}
              stroke="#92400e"
              strokeOpacity={0.65}
              strokeWidth={floorStroke}
            />
          ))}
          {layers.stairPaths.map((d, i) => (
            <path
              key={`stair-${i}`}
              d={d}
              fill="#fde68a"
              fillOpacity={0.75}
              stroke="#b45309"
              strokeWidth={stairStroke}
            />
          ))}

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

          {layers.wallPathsEdgeOn.map((d, i) => (
            <path
              key={`wall-e-${i}`}
              d={d}
              fill={`url(#${defsId}-wall-edgeOn)`}
              fillOpacity={0.92}
              stroke="#020617"
              strokeWidth={wallStroke}
            />
          ))}
          {layers.wallPathsAlongCut.map((d, i) => (
            <path
              key={`wall-a-${i}`}
              d={d}
              fill={`url(#${defsId}-wall-alongCut)`}
              fillOpacity={0.9}
              stroke="#020617"
              strokeWidth={wallStroke}
            />
          ))}

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

          {roofChordPath.map((d, i) => (
            <path
              key={`roof-${i}`}
              d={d}
              fill="none"
              stroke="#065f46"
              strokeWidth={roofStroke}
              strokeDasharray={`${6 * strokeScale} ${10 * strokeScale}`}
            />
          ))}
          {layers.windows.map((w, i) => {
            const b = openingPx(layers, w);
            const showTag = Math.min(b.w, b.h) >= openingTagMinPx;
            return (
              <g key={`win-${w.id}-${i}`}>
                <rect
                  x={b.x + 2}
                  y={b.y + 2}
                  width={Math.max(0, b.w - 4)}
                  height={Math.max(0, b.h - 4)}
                  fill="#ecfdf5"
                  stroke="#047857"
                  strokeWidth={winStroke}
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
              </g>
            );
          })}

          {layers.doors.map((w, i) => {
            const b = openingPx(layers, w);
            const showTag = Math.min(b.w, b.h) >= openingTagMinPx;
            return (
              <g key={`dor-${w.id}-${i}`}>
                <rect
                  x={b.x + 2}
                  y={b.y + 2}
                  width={Math.max(0, b.w - 4)}
                  height={Math.max(0, b.h - 4)}
                  fill="#fefefe"
                  stroke="#1f2937"
                  strokeWidth={doorStroke}
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
