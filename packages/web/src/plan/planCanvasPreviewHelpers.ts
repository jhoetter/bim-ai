import * as THREE from 'three';

import { areaBoundaryCanClose } from '../tools/toolGrammar';
import { buildMarqueePreview, disposeMarqueePreview } from './marqueeSelectionPreview';
import { readPlanToken } from './planCanvasHelpers';
import { SLICE_Y } from './interaction/planCameraMath';

type MutableRef<T> = {
  current: T;
};

type Props = {
  group: THREE.Group;
  previewRef: MutableRef<THREE.Line | null>;
  marqueeLineRef: MutableRef<THREE.Line | null>;
  marqueeFillRef: MutableRef<THREE.Mesh | null>;
};

export function createPlanCanvasPreviewHelpers({
  group,
  previewRef,
  marqueeLineRef,
  marqueeFillRef,
}: Props) {
  const clearPreview = () => {
    if (previewRef.current) {
      group.remove(previewRef.current);
      previewRef.current.geometry.dispose();
      previewRef.current = null;
    }
  };

  const redrawSeg = (a: THREE.Vector3, b: THREE.Vector3) => {
    clearPreview();
    previewRef.current = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([a, b]),
      new THREE.LineBasicMaterial({
        color: readPlanToken('--draft-construction-blue', '#fcd34d'),
      }),
    );
    group.add(previewRef.current);
  };

  const redrawPreviewRectMm = (x0Mm: number, y0Mm: number, x1Mm: number, y1Mm: number) => {
    const xMn = Math.min(x0Mm, x1Mm) / 1000;
    const xMx = Math.max(x0Mm, x1Mm) / 1000;
    const zMn = Math.min(y0Mm, y1Mm) / 1000;
    const zMx = Math.max(y0Mm, y1Mm) / 1000;
    const pts = [
      new THREE.Vector3(xMn, SLICE_Y, zMn),
      new THREE.Vector3(xMx, SLICE_Y, zMn),
      new THREE.Vector3(xMx, SLICE_Y, zMx),
      new THREE.Vector3(xMn, SLICE_Y, zMx),
      new THREE.Vector3(xMn, SLICE_Y, zMn),
    ];
    clearPreview();
    previewRef.current = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: readPlanToken('--cat-room', '#a7f3d0') }),
    );
    group.add(previewRef.current);
  };

  const redrawAreaBoundaryPreviewMm = (
    verts: Array<{ xMm: number; yMm: number }>,
    cursorMm?: { xMm: number; yMm: number },
  ) => {
    clearPreview();
    const ptsMm = cursorMm ? [...verts, cursorMm] : [...verts];
    if (ptsMm.length === 0) return;
    if (ptsMm.length >= 3 && cursorMm && areaBoundaryCanClose(verts, cursorMm)) {
      ptsMm[ptsMm.length - 1] = verts[0]!;
    }
    const pts = ptsMm.map((pt) => new THREE.Vector3(pt.xMm / 1000, SLICE_Y, pt.yMm / 1000));
    const mat = new THREE.LineDashedMaterial({
      color: readPlanToken('--draft-construction-blue', '#fcd34d'),
      dashSize: 0.22,
      gapSize: 0.1,
    });
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    line.computeLineDistances();
    previewRef.current = line;
    group.add(line);
  };

  const clearMarqueeLine = () => {
    disposeMarqueePreview(group, {
      line: marqueeLineRef.current,
      fill: marqueeFillRef.current,
    });
    marqueeLineRef.current = null;
    marqueeFillRef.current = null;
  };

  const redrawMarqueeRect = (
    x0Mm: number,
    y0Mm: number,
    x1Mm: number,
    y1Mm: number,
    crossing: boolean,
  ) => {
    clearMarqueeLine();
    const { line, fill } = buildMarqueePreview(x0Mm, y0Mm, x1Mm, y1Mm, crossing);
    marqueeLineRef.current = line;
    group.add(line);
    marqueeFillRef.current = fill;
    group.add(fill);
  };

  return {
    clearMarqueeLine,
    clearPreview,
    redrawAreaBoundaryPreviewMm,
    redrawMarqueeRect,
    redrawPreviewRectMm,
    redrawSeg,
  };
}
