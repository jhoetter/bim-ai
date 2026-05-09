import type { ReactElement } from 'react';

import type { Element, Sheet, TitleblockType } from '@bim-ai/core';

// A1 landscape physical dimensions in mm
const A1_W_MM = 841;
const A1_H_MM = 594;

// Cartouche dimensions (bottom-right, per A1 convention)
const CARTOUCHE_W_MM = 148;
const CARTOUCHE_H_MM = 50;

const SHEET_SIZE_MM: Record<string, { w: number; h: number }> = {
  A0: { w: 1189, h: 841 },
  A1: { w: 841, h: 594 },
  A2: { w: 594, h: 420 },
  A3: { w: 420, h: 297 },
};

export type SheetCanvasProps = {
  elementsById: Record<string, Element>;
  preferredSheetId?: string;
  modelId?: string;
  evidenceFullBleed?: boolean;
};

function resolveTokenValue(slotName: string, sheet: Sheet): string {
  const meta = sheet.metadata ?? {};
  switch (slotName) {
    case 'projectName':
      return meta.projectName ?? '';
    case 'drawnBy':
      return meta.drawnBy ?? '';
    case 'checkedBy':
      return meta.checkedBy ?? '';
    case 'date':
      return meta.date ?? '';
    case 'revision':
      return meta.revision ?? '';
    case 'number':
      return sheet.number ?? '';
    default:
      return '';
  }
}

function findSheet(
  elementsById: Record<string, Element>,
  preferredSheetId?: string,
): Sheet | undefined {
  if (preferredSheetId) {
    const el = elementsById[preferredSheetId];
    if (el?.kind === 'sheet') return el as Sheet;
  }
  return (Object.values(elementsById) as Element[]).find(
    (e): e is Sheet => e.kind === 'sheet',
  );
}

function findTitleblockType(
  elementsById: Record<string, Element>,
  sheet: Sheet,
): TitleblockType | undefined {
  if (sheet.titleblockTypeId) {
    const el = elementsById[sheet.titleblockTypeId];
    if (el?.kind === 'titleblock_type') return el as TitleblockType;
  }
  return (Object.values(elementsById) as Element[]).find(
    (e): e is TitleblockType => e.kind === 'titleblock_type',
  );
}

export function SheetCanvas({
  elementsById,
  preferredSheetId,
}: SheetCanvasProps): ReactElement {
  const sheet = findSheet(elementsById, preferredSheetId);
  const titleblockType = sheet ? findTitleblockType(elementsById, sheet) : undefined;

  // Fallback dimensions when no sheet found
  const landscape = (sheet?.orientation ?? 'landscape') === 'landscape';
  const sizeKey = sheet?.size ?? 'A1';
  const base = SHEET_SIZE_MM[sizeKey] ?? SHEET_SIZE_MM['A1'];
  const sheetW = landscape ? base.w : base.h;
  const sheetH = landscape ? base.h : base.w;

  // Scale to fit viewport (max 1200px wide)
  const maxPx = 1200;
  const scale = maxPx / sheetW;
  const svgW = sheetW * scale;
  const svgH = sheetH * scale;

  const toSvgX = (mm: number) => mm * scale;
  const toSvgY = (mm: number) => mm * scale;

  const cartoucheX = sheetW - CARTOUCHE_W_MM;
  const cartoucheY = sheetH - CARTOUCHE_H_MM;

  const placements = sheet?.viewPlacements ?? [];

  // Drawable area (excluding cartouche column)
  const drawableW = sheetW - CARTOUCHE_W_MM - 20;
  const drawableH = sheetH - 20;
  const drawableCenterX = toSvgX(10 + drawableW / 2);
  const drawableCenterY = toSvgY(10 + drawableH / 2);

  if (!sheet) {
    // No sheet element at all — render minimal placeholder
    return (
      <svg
        width={svgW}
        height={svgH}
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ display: 'block', background: 'white' }}
      >
        <rect x={0} y={0} width={svgW} height={svgH} fill="white" stroke="#ccc" strokeWidth={1} />
        <text
          x={svgW / 2}
          y={svgH / 2 - 8}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 11, fill: '#aaa' }}
        >
          No sheet found
        </text>
        <text
          x={svgW / 2}
          y={svgH / 2 + 8}
          textAnchor="middle"
          dominantBaseline="middle"
          style={{ fontSize: 9, fill: '#bbb' }}
        >
          Add a sheet element to your model
        </text>
      </svg>
    );
  }

  return (
    <svg
      width={svgW}
      height={svgH}
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ display: 'block', background: 'var(--color-surface-1)' }}
    >
      {/* Sheet border */}
      <rect
        x={0}
        y={0}
        width={svgW}
        height={svgH}
        fill="var(--color-surface-1)"
        stroke="var(--draft-lw-cut-major)"
        strokeWidth={1}
      />

      {/* View placement viewports */}
      {placements.map((vp) => {
        const vpX = toSvgX(vp.minXY.x);
        const vpY = toSvgY(vp.minXY.y);
        const vpW = toSvgX(vp.size.x);
        const vpH = toSvgY(vp.size.y);
        const viewName =
          (elementsById[vp.viewId] as { name?: string } | undefined)?.name ?? vp.viewId;
        return (
          <g key={vp.viewId}>
            <rect
              x={vpX}
              y={vpY}
              width={vpW}
              height={vpH}
              fill="var(--color-muted)"
              fillOpacity={0.06}
              stroke="var(--draft-lw-cut-major)"
              strokeWidth={0.5}
              strokeDasharray="4 2"
            />
            <text
              x={vpX + vpW / 2}
              y={vpY + vpH / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: 8, fill: 'var(--color-muted)' }}
            >
              {viewName}
            </text>
          </g>
        );
      })}

      {/* Empty-state message when no placements */}
      {placements.length === 0 && (
        <>
          <rect
            x={toSvgX(10)}
            y={toSvgY(10)}
            width={toSvgX(drawableW)}
            height={toSvgY(drawableH)}
            fill="none"
            stroke="var(--color-muted)"
            strokeDasharray="6 3"
            strokeWidth={0.5}
          />
          <text
            x={drawableCenterX}
            y={drawableCenterY - toSvgY(3)}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 11, fill: 'var(--color-muted)' }}
          >
            No views placed
          </text>
          <text
            x={drawableCenterX}
            y={drawableCenterY + toSvgY(5)}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: 9, fill: 'var(--color-muted)' }}
          >
            Open a plan view, then drag it onto this sheet
          </text>
        </>
      )}

      {/* Titleblock cartouche box */}
      <rect
        x={toSvgX(cartoucheX)}
        y={toSvgY(cartoucheY)}
        width={toSvgX(CARTOUCHE_W_MM)}
        height={toSvgY(CARTOUCHE_H_MM)}
        fill="var(--color-surface-1)"
        stroke="var(--draft-lw-cut-major)"
        strokeWidth={1}
      />

      {/* Token slots */}
      {titleblockType?.tokenSlots.map((slot) => {
        const value = resolveTokenValue(slot.name, sheet);
        const isProjectName = slot.name === 'projectName';
        return (
          <text
            key={slot.name}
            x={toSvgX(slot.xMm)}
            y={toSvgY(slot.yMm)}
            style={{
              fontSize: (isProjectName ? (slot.fontSizeMm ?? 3.5) * 1.3 : (slot.fontSizeMm ?? 3.5)) * scale,
              fill: isProjectName ? 'var(--color-foreground)' : 'var(--color-muted)',
              fontWeight: isProjectName ? 600 : undefined,
            }}
          >
            {value || slot.name}
          </text>
        );
      })}
    </svg>
  );
}
