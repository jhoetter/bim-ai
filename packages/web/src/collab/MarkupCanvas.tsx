import React, { useCallback, useRef, useState } from 'react';
import type { Markup, MarkupShape } from '@bim-ai/core';

interface MarkupCanvasProps {
  markups: Markup[];
  viewId?: string;
  /** When true the canvas captures pointer input for freehand drawing. */
  drawingActive: boolean;
  activeShape: 'freehand' | 'arrow' | 'cloud' | 'text';
  onStrokeComplete?: (pathPx: Array<{ xPx: number; yPx: number }>) => void;
  width: number;
  height: number;
}

function _freehandPoints(pathPx: Array<{ xPx: number; yPx: number }>): string {
  return pathPx.map((p) => `${p.xPx},${p.yPx}`).join(' ');
}

function _cloudPath(pointsMm: Array<{ xMm: number; yMm: number }>): string {
  if (pointsMm.length < 2) return '';
  return pointsMm.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.xMm},${p.yMm}`).join(' ') + ' Z';
}

function MarkupShapeEl({ shape, resolved }: { shape: MarkupShape; resolved: boolean }) {
  const opacity = resolved ? 0.2 : 1;

  if (shape.kind === 'freehand') {
    return (
      <polyline
        points={_freehandPoints(shape.pathPx)}
        stroke={shape.color}
        strokeWidth={shape.strokeWidthPx}
        fill="none"
        opacity={opacity}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  if (shape.kind === 'arrow') {
    const dx = shape.toMm.xMm - shape.fromMm.xMm;
    const dy = shape.toMm.yMm - shape.fromMm.yMm;
    const id = `arrow-${Math.random().toString(36).slice(2)}`;
    return (
      <>
        <defs>
          <marker id={id} markerWidth={6} markerHeight={6} refX={5} refY={3} orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill={shape.color} />
          </marker>
        </defs>
        <line
          x1={shape.fromMm.xMm}
          y1={shape.fromMm.yMm}
          x2={shape.toMm.xMm}
          y2={shape.toMm.yMm}
          stroke={shape.color}
          strokeWidth={2}
          markerEnd={`url(#${id})`}
          opacity={opacity}
        />
      </>
    );
  }

  if (shape.kind === 'cloud') {
    return (
      <path
        d={_cloudPath(shape.pointsMm)}
        stroke="var(--cat-review)"
        strokeWidth={2}
        fill="none"
        strokeDasharray="8 4"
        opacity={opacity}
      />
    );
  }

  if (shape.kind === 'text') {
    return (
      <text
        x={shape.positionMm.xMm}
        y={shape.positionMm.yMm}
        fill="var(--cat-edit)"
        fontSize={14}
        opacity={opacity}
        fontFamily="sans-serif"
      >
        {shape.bodyMd}
      </text>
    );
  }

  return null;
}

export function MarkupCanvas({
  markups,
  viewId,
  drawingActive,
  activeShape,
  onStrokeComplete,
  width,
  height,
}: MarkupCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [liveStroke, setLiveStroke] = useState<Array<{ xPx: number; yPx: number }>>([]);
  const drawing = useRef(false);

  const visible = markups.filter((m) => !viewId || !m.viewId || m.viewId === viewId);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!drawingActive || activeShape !== 'freehand') return;
      drawing.current = true;
      const rect = svgRef.current!.getBoundingClientRect();
      setLiveStroke([{ xPx: e.clientX - rect.left, yPx: e.clientY - rect.top }]);
      (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    },
    [drawingActive, activeShape],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing.current) return;
    const rect = svgRef.current!.getBoundingClientRect();
    setLiveStroke((prev) => [...prev, { xPx: e.clientX - rect.left, yPx: e.clientY - rect.top }]);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!drawing.current) return;
    drawing.current = false;
    if (liveStroke.length > 1) {
      onStrokeComplete?.(liveStroke);
    }
    setLiveStroke([]);
  }, [liveStroke, onStrokeComplete]);

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: drawingActive ? 'all' : 'none',
        cursor: drawingActive ? 'crosshair' : 'default',
      }}
      width={width}
      height={height}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {visible.map((m) => (
        <MarkupShapeEl key={m.id} shape={m.shape} resolved={m.resolvedAt != null} />
      ))}
      {liveStroke.length > 1 && (
        <polyline
          points={liveStroke.map((p) => `${p.xPx},${p.yPx}`).join(' ')}
          stroke="var(--cat-edit)"
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.7}
        />
      )}
    </svg>
  );
}
