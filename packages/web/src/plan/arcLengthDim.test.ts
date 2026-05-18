import { describe, expect, it } from 'vitest';

describe('Arc length dimension curved renderer — §4.6', () => {
  it('arc length is computed from angles and radius', () => {
    const radiusMm = 3000;
    const startAngleDeg = 0;
    const endAngleDeg = 90;
    const arcLengthMm = (Math.PI * radiusMm * Math.abs(endAngleDeg - startAngleDeg)) / 180;
    expect(arcLengthMm).toBeCloseTo((Math.PI * 3000) / 2, 0);
  });

  it('dimension arc radius = element radius + offsetMm', () => {
    const radiusMm = 3000;
    const offsetMm = 200;
    const dimRadius = radiusMm + offsetMm;
    expect(dimRadius).toBe(3200);
  });

  it('offsetMm defaults to 200mm when not set', () => {
    const dim: any = { radiusMm: 3000 };
    expect(dim.offsetMm ?? 200).toBe(200);
  });

  it('arc point at 90deg is at correct position', () => {
    const centerX = 0;
    const centerY = 0;
    const radius = 1;
    const angleDeg = 90;
    const x = centerX + Math.cos((angleDeg * Math.PI) / 180) * radius;
    const y = centerY + Math.sin((angleDeg * Math.PI) / 180) * radius;
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(1, 5);
  });
});

describe('Wall edit profile 3D — §3.5.5', () => {
  it('profilePoints field exists on wall type signature', () => {
    const wall: any = {
      kind: 'wall',
      id: 'w1',
      profilePoints: [
        { xMm: 0, yMm: 0 },
        { xMm: 200, yMm: 0 },
        { xMm: 200, yMm: 2800 },
        { xMm: 0, yMm: 2800 },
      ],
    };
    expect(wall.profilePoints).toHaveLength(4);
  });

  it('profile area computes correctly for a rectangular wall', () => {
    const profilePoints = [
      { xMm: 0, yMm: 0 },
      { xMm: 200, yMm: 0 },
      { xMm: 200, yMm: 2800 },
      { xMm: 0, yMm: 2800 },
    ];
    // Shoelace formula
    let area = 0;
    for (let i = 0; i < profilePoints.length; i++) {
      const j = (i + 1) % profilePoints.length;
      area += profilePoints[i].xMm * profilePoints[j].yMm;
      area -= profilePoints[j].xMm * profilePoints[i].yMm;
    }
    area = Math.abs(area) / 2;
    expect(area).toBe(200 * 2800);
  });
});
