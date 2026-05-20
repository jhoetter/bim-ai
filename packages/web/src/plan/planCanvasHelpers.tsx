import { liveTokenReader } from '../viewport/materials';
import type { SubdivisionCategory } from '../workspace/authoring';
import type { MmPoint } from './wallRadiusFillet';

export function readPlanToken(name: string, fallback: string): string {
  const v = liveTokenReader().read(name);
  return v && v.trim().length > 0 ? v : fallback;
}

export function ComponentPlacementPreviewGlyph({ symbolKind }: { symbolKind?: string }) {
  if (symbolKind === 'toilet') {
    return (
      <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
        <rect x="18" y="8" width="28" height="48" rx="4" fill="#dbeafe" opacity="0.72" />
        <ellipse cx="32" cy="31" rx="15" ry="18" fill="#eff6ff" stroke="#2563eb" strokeWidth="3" />
        <rect
          x="22"
          y="8"
          width="20"
          height="15"
          rx="2"
          fill="#bfdbfe"
          stroke="#2563eb"
          strokeWidth="3"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="h-full w-full" aria-hidden="true">
      <rect
        x="10"
        y="14"
        width="44"
        height="36"
        rx="3"
        fill="#dbeafe"
        opacity="0.62"
        stroke="#2563eb"
        strokeWidth="3"
      />
      <path d="M14 18 L50 46 M50 18 L14 46" stroke="#2563eb" strokeWidth="2.5" />
    </svg>
  );
}

export type Draft =
  | {
      kind: 'wall';
      sx: number;
      sy: number;
      previousWall?: {
        id: string;
        pathStart: MmPoint;
        pathEnd: MmPoint;
        actualStart: MmPoint;
        actualEnd: MmPoint;
        cornerEndpoint: 'start' | 'end';
      };
    }
  | { kind: 'grid'; sx: number; sy: number }
  | { kind: 'dim'; ax: number; ay: number }
  | { kind: 'measure'; ax: number; ay: number }
  | { kind: 'room_rect'; sx: number; sy: number }
  | { kind: 'reference-plane'; sx: number; sy: number }
  | { kind: 'property-line'; sx: number; sy: number }
  | { kind: 'area-boundary'; verts: Array<{ xMm: number; yMm: number }> }
  | { kind: 'masking-region'; sx: number; sy: number }
  | { kind: 'plan-region'; sx: number; sy: number }
  | {
      kind: 'detail-region';
      verts: Array<{ xMm: number; yMm: number }>;
      closed: boolean;
      hatchId: string | null;
    }
  | {
      kind: 'toposolid-subdivision';
      verts: Array<{ xMm: number; yMm: number }>;
      finishCategory: SubdivisionCategory;
    }
  | { kind: 'slope-annotation'; sx: number; sy: number }
  | { kind: 'revision-cloud'; points: Array<{ xMm: number; yMm: number }> }
  | { kind: 'model-line'; points: Array<{ xMm: number; yMm: number }> };

export function guessGridLabel(sxMm: number, syMm: number, exMm: number, eyMm: number): string {
  const horizontal = Math.abs(eyMm - syMm) < Math.abs(exMm - sxMm);
  return horizontal
    ? `Axis ${Math.floor(Math.abs((syMm + 5000) / 3800)) + 1}`
    : String.fromCharCode(66 + Math.min(10, Math.floor(Math.abs(exMm - sxMm + 8200) / 4200)));
}

/** F-025: Format an elevation in mm as +/-X.XXX m for the plan canvas badge. */
export function fmtElev(mm: number): string {
  const m = mm / 1000;
  if (Math.abs(m) < 0.0005) return '±0.000 m';
  return `${m >= 0 ? '+' : '−'}${Math.abs(m).toFixed(3)} m`;
}
