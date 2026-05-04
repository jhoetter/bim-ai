import { useEffect, useMemo, useState } from 'react';

import { fetchSectionProjectionWire } from '../plan/sectionProjectionWire';

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

/** Build pixel-space SVG paths/shapes from `sectionProjectionPrimitives_v1`. */
export function SectionViewportSvg(props: {
  modelId: string;
  sectionCutId: string;
  widthPx: number;
  heightPx: number;
}) {
  const [err, setErr] = useState<string | null>(null);

  type LayerSnap = {
    wallPaths: string[];
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
  };

  const [layers, setLayers] = useState<LayerSnap | null>(null);

  const defsId = useMemo(
    () => `sec-hatch-${props.sectionCutId.replace(/[^\w]/g, '')}`,
    [props.sectionCutId],
  );

  useEffect(() => {
    let cancel = false;
    void (async () => {
      try {
        const payload = await fetchSectionProjectionWire(props.modelId, props.sectionCutId);
        const prim = payload.primitives as Record<string, unknown> | undefined;
        const wallsRaw = prim?.walls;
        if (!Array.isArray(wallsRaw) || wallsRaw.length === 0) {
          if (!cancel) {
            setErr(null);

            setLayers(null);
          }
          return;
        }

        const asUz = (w: Record<string, unknown>): UzPrim | null => ({
          uStartMm: Number(w.uStartMm ?? 0),

          uEndMm: Number(w.uEndMm ?? 0),

          zBottomMm: Number(w.zBottomMm ?? 0),

          zTopMm: Number(w.zTopMm ?? 0),
        });

        const rects: UzPrim[] = [];

        for (const w of wallsRaw as Record<string, unknown>[]) {
          const p = asUz(w);

          if (!p) continue;

          rects.push(p);
        }

        const floorRects: UzPrim[] = [];

        const floorsRaw = prim?.floors;

        if (Array.isArray(floorsRaw)) {
          for (const w of floorsRaw as Record<string, unknown>[]) {
            const p = asUz(w);

            if (!p) continue;

            floorRects.push(p);
          }
        }

        const roomRects: UzPrim[] = [];

        const roomsRaw = prim?.rooms;

        if (Array.isArray(roomsRaw)) {
          for (const w of roomsRaw as Record<string, unknown>[]) {
            const p = asUz(w);

            if (!p) continue;

            roomRects.push(p);
          }
        }

        const stairRects: UzPrim[] = [];

        const stairsRaw = prim?.stairs;

        if (Array.isArray(stairsRaw)) {
          for (const w of stairsRaw as Record<string, unknown>[]) {
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

        widen(...rects);

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

        const wallPaths = rects.map(rectPath);

        const floorPaths = floorRects.map(rectPath);

        const roomPaths = roomRects.map(rectPath);

        const stairPaths = stairRects.map(rectPath);

        if (!cancel) {
          setErr(null);

          setLayers({
            wallPaths,

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
          });
        }
      } catch (e) {
        if (!cancel) {
          setErr(e instanceof Error ? e.message : String(e));

          setLayers(null);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [props.modelId, props.sectionCutId, props.widthPx, props.heightPx]);

  const vb = `0 0 ${props.widthPx} ${props.heightPx}`;

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
          id={`${defsId}-wall`}
          width={10}
          height={10}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1={0} y1={0} x2={0} y2={10} stroke="#475569" strokeWidth={3} />
        </pattern>

        <pattern id={`${defsId}-slab`} width={14} height={14} patternUnits="userSpaceOnUse">
          <rect width={14} height={14} fill="#fef3c7" />

          <path d="M0 14 L14 0" stroke="#ca8a04" strokeOpacity={0.35} strokeWidth={1} />
        </pattern>
      </defs>

      <rect
        width={props.widthPx}
        height={props.heightPx}
        fill="#fafafa"
        stroke="#cbd5e1"
        strokeWidth={3}
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
              stroke="#b45309"
              strokeOpacity={0.55}
              strokeWidth={2}
            />
          ))}
          {layers.stairPaths.map((d, i) => (
            <path
              key={`stair-${i}`}
              d={d}
              fill="#fde68a"
              fillOpacity={0.75}
              stroke="#b45309"
              strokeWidth={2}
            />
          ))}

          {layers.wallPaths.map((d, i) => (
            <path
              key={`wall-${i}`}
              d={d}
              fill={`url(#${defsId}-wall)`}
              fillOpacity={0.9}
              stroke="#0f172a"
              strokeWidth={2.5}
            />
          ))}

          {roofChordPath.map((d, i) => (
            <path
              key={`roof-${i}`}
              d={d}
              fill="none"
              stroke="#065f46"
              strokeWidth={3}
              strokeDasharray="6 10"
            />
          ))}
          {layers.windows.map((w, i) => {
            const b = openingPx(layers, w);

            return (
              <rect
                key={`win-${w.id}-${i}`}
                x={b.x + 2}
                y={b.y + 2}
                width={Math.max(0, b.w - 4)}
                height={Math.max(0, b.h - 4)}
                fill="#ecfdf5"
                stroke="#047857"
                strokeWidth={1}
                strokeDasharray="6 6"
              />
            );
          })}

          {layers.doors.map((w, i) => {
            const b = openingPx(layers, w);

            return (
              <rect
                key={`dor-${w.id}-${i}`}
                x={b.x + 2}
                y={b.y + 2}
                width={Math.max(0, b.w - 4)}
                height={Math.max(0, b.h - 4)}
                fill="#fefefe"
                stroke="#1f2937"
                strokeWidth={1.75}
              />
            );
          })}
        </>
      ) : null}
      {err ? (
        <text x={8} y={16} fill="#b45309" style={{ fontSize: 10 }}>
          {err}
        </text>
      ) : null}
    </svg>
  );
}
