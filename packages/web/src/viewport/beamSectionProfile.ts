import * as THREE from 'three';

/**
 * Builds a THREE.Shape representing the cross-section of a beam in local YZ plane.
 * All dimensions are converted from mm to metres internally.
 */
export function buildBeamSectionShape(
  sectionProfile: string | null | undefined,
  widthMm: number,
  heightMm: number,
  flangeWidthMm?: number | null,
  webThicknessMm?: number | null,
  flangeThicknessMm?: number | null,
): THREE.Shape {
  const w = widthMm / 1000;
  const h = heightMm / 1000;
  const fw = (flangeWidthMm ?? widthMm) / 1000;
  const wt = (webThicknessMm ?? Math.max(20, widthMm * 0.1)) / 1000;
  const ft = (flangeThicknessMm ?? Math.max(15, heightMm * 0.1)) / 1000;

  switch (sectionProfile) {
    case 'I':
    case 'H':
      return _iShape(fw, h, wt, ft);
    case 'C':
      return _cShape(fw, h, wt, ft);
    case 'L':
      return _lShape(w, h, wt);
    case 'T':
      return _tShape(fw, h, wt, ft);
    case 'HSS':
      return _hssShape(w, h);
    default:
      return _rectShape(w, h);
  }
}

function _rectShape(w: number, h: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -h / 2);
  s.lineTo(w / 2, -h / 2);
  s.lineTo(w / 2, h / 2);
  s.lineTo(-w / 2, h / 2);
  s.closePath();
  return s;
}

function _iShape(fw: number, h: number, wt: number, ft: number): THREE.Shape {
  const hw = fw / 2;
  const hh = h / 2;
  const hwt = wt / 2;
  const s = new THREE.Shape();
  // bottom flange
  s.moveTo(-hw, -hh);
  s.lineTo(hw, -hh);
  s.lineTo(hw, -hh + ft);
  // step in to web
  s.lineTo(hwt, -hh + ft);
  // web up
  s.lineTo(hwt, hh - ft);
  // top flange right
  s.lineTo(hw, hh - ft);
  s.lineTo(hw, hh);
  s.lineTo(-hw, hh);
  s.lineTo(-hw, hh - ft);
  // step in to web
  s.lineTo(-hwt, hh - ft);
  // web down
  s.lineTo(-hwt, -hh + ft);
  // bottom flange left
  s.lineTo(-hw, -hh + ft);
  s.closePath();
  return s;
}

function _cShape(fw: number, h: number, wt: number, ft: number): THREE.Shape {
  // ⊏ — flanges extend to the right from the web on the left
  const hh = h / 2;
  const s = new THREE.Shape();
  // outer outline, starting at bottom-left
  s.moveTo(0, -hh);
  s.lineTo(fw, -hh);
  s.lineTo(fw, -hh + ft);
  s.lineTo(wt, -hh + ft);
  s.lineTo(wt, hh - ft);
  s.lineTo(fw, hh - ft);
  s.lineTo(fw, hh);
  s.lineTo(0, hh);
  s.closePath();
  return s;
}

function _lShape(w: number, h: number, legThickness: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(w, 0);
  s.lineTo(w, legThickness);
  s.lineTo(legThickness, legThickness);
  s.lineTo(legThickness, h);
  s.lineTo(0, h);
  s.closePath();
  return s;
}

function _tShape(fw: number, h: number, wt: number, ft: number): THREE.Shape {
  const hw = fw / 2;
  const hwt = wt / 2;
  const s = new THREE.Shape();
  // top flange
  s.moveTo(-hw, h - ft);
  s.lineTo(hw, h - ft);
  s.lineTo(hw, h);
  s.lineTo(-hw, h);
  s.closePath();
  // web — add as separate contour path is simpler; just build a combined shape
  const shape = new THREE.Shape();
  // top flange
  shape.moveTo(-hw, h - ft);
  shape.lineTo(hw, h - ft);
  shape.lineTo(hw, h);
  shape.lineTo(-hw, h);
  shape.lineTo(-hw, h - ft);
  // descend web
  shape.lineTo(-hwt, h - ft);
  shape.lineTo(-hwt, 0);
  shape.lineTo(hwt, 0);
  shape.lineTo(hwt, h - ft);
  shape.lineTo(hw, h - ft);
  // close
  shape.closePath();
  return shape;
}

function _hssShape(w: number, h: number): THREE.Shape {
  const wallT = Math.min(w, h) * 0.1;
  const outer = new THREE.Shape();
  outer.moveTo(-w / 2, -h / 2);
  outer.lineTo(w / 2, -h / 2);
  outer.lineTo(w / 2, h / 2);
  outer.lineTo(-w / 2, h / 2);
  outer.closePath();

  const iw = w - 2 * wallT;
  const ih = h - 2 * wallT;
  const hole = new THREE.Path();
  hole.moveTo(-iw / 2, -ih / 2);
  hole.lineTo(iw / 2, -ih / 2);
  hole.lineTo(iw / 2, ih / 2);
  hole.lineTo(-iw / 2, ih / 2);
  hole.closePath();
  outer.holes.push(hole);

  return outer;
}
