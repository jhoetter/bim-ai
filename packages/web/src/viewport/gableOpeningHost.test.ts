/**
 * Issue #109 — Giebelverglasung: openings on gable-shaped walls.
 *
 * Today's CSG path treats every wall as a rectangle and shrinks any
 * window that would sit in the gable triangle down to the eave. The
 * fix has three independent contracts that this file pins down:
 *
 *   1. ``sampleWallGableProfile`` returns a per-sample profile + peak
 *      from an injected roof-height sampler, and only flags
 *      ``hasGable=true`` when the profile actually rises above the
 *      rectangular wall top by a visible margin.
 *   2. ``wallBaseGeometryForCsg`` builds a sloped-top prism whose
 *      vertical extent matches the peak when ``topProfileM`` is supplied
 *      — so window cutters whose ``localY`` lands in the gable zone
 *      actually have wall mass to subtract from.
 *   3. ``diagnoseWallHostedCutRenderRisks`` no longer flags a window
 *      whose head reaches above the rectangular wall height when the
 *      host wall is attached to a gable / non-flat roof — without that
 *      relaxation, Giebelverglasung windows surface a false-positive
 *      ``hosted_cut_vertical_extent_outside_host`` error.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import type { Element } from '@bim-ai/core';

import { wallBaseGeometryForCsg } from './csgWallBaseGeometry';
import { sampleWallGableProfile } from './wallGableProfile';
import {
  diagnoseWallHostedCutRenderRisks,
  type WallHostedCutRenderDiagnosticCode,
} from './wallHostedCutRenderDiagnostics';

describe('sampleWallGableProfile — issue #109', () => {
  it('flags a flat-top wall (constant sampler) as hasGable=false', () => {
    const profile = sampleWallGableProfile({
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 6000, yMm: 0 },
      rectangularHeightM: 2.8,
      yBaseM: 0,
      sampleRoofTopYM: () => 2.8,
    });
    expect(profile.hasGable).toBe(false);
    expect(profile.peakHeightM).toBeCloseTo(2.8, 5);
    expect(profile.topProfileM.length).toBeGreaterThanOrEqual(2);
    for (const h of profile.topProfileM) expect(h).toBeCloseTo(2.8, 5);
  });

  it('captures a symmetric gable peak above a 6 m gable wall (eave 2.8 m, peak 5.0 m)', () => {
    // Symmetric tent: highest at x=3000, drops to eave at x=0 and x=6000.
    const profile = sampleWallGableProfile({
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 6000, yMm: 0 },
      rectangularHeightM: 2.8,
      yBaseM: 0,
      sampleRoofTopYM: (xMm) => {
        const tFromCentre = Math.abs(xMm - 3000) / 3000; // 0 at peak, 1 at eaves
        return 2.8 + (1 - tFromCentre) * 2.2; // peak adds 2.2 m
      },
    });
    expect(profile.hasGable).toBe(true);
    expect(profile.peakHeightM).toBeCloseTo(5.0, 1);
    // Endpoints clamp to the eave (sampler returns rectangularHeightM there).
    expect(profile.topProfileM[0]).toBeCloseTo(2.8, 5);
    expect(profile.topProfileM[profile.topProfileM.length - 1]).toBeCloseTo(2.8, 5);
  });

  it('never dips below the rectangular wall height even when the sampler returns less', () => {
    // Faulty sampler: returns negative for everything. We should still
    // hold the floor at rectangularHeightM (defensive: a missing host
    // mustn't carve a hole below the eave).
    const profile = sampleWallGableProfile({
      startMm: { xMm: 0, yMm: 0 },
      endMm: { xMm: 6000, yMm: 0 },
      rectangularHeightM: 2.8,
      yBaseM: 0,
      sampleRoofTopYM: () => -10,
    });
    expect(profile.hasGable).toBe(false);
    for (const h of profile.topProfileM) expect(h).toBeGreaterThanOrEqual(2.8);
  });
});

describe('wallBaseGeometryForCsg — gable prism path (issue #109)', () => {
  it('falls back to a plain box when no topProfile is supplied', () => {
    const geom = wallBaseGeometryForCsg(6, 2.8, 0.2);
    const box = new THREE.Box3().setFromBufferAttribute(
      geom.getAttribute('position') as THREE.BufferAttribute,
    );
    expect(box.min.x).toBeCloseTo(-3, 5);
    expect(box.max.x).toBeCloseTo(3, 5);
    expect(box.min.y).toBeCloseTo(-1.4, 5);
    expect(box.max.y).toBeCloseTo(1.4, 5);
  });

  it('builds a sloped-top prism whose peak extends above the rectangular y=+h/2', () => {
    // Wall 6 m × 2.8 m × 0.2 m; gable peak 5.0 m above base at midspan.
    const topProfile = [2.8, 3.9, 5.0, 3.9, 2.8];
    const geom = wallBaseGeometryForCsg(6, 2.8, 0.2, undefined, topProfile);
    const box = new THREE.Box3().setFromBufferAttribute(
      geom.getAttribute('position') as THREE.BufferAttribute,
    );
    // Bottom face still at y = -h/2 so the CSG worker's existing wcy
    // (yBase + height/2) places the wall base on the slab.
    expect(box.min.y).toBeCloseTo(-1.4, 5);
    // Top extends to the gable peak: peakHeight - height/2 = 5.0 - 1.4 = 3.6.
    expect(box.max.y).toBeCloseTo(3.6, 2);
    // Thickness preserved.
    expect(box.max.z - box.min.z).toBeCloseTo(0.2, 5);
  });

  it('keeps the box fast path when the profile never rises above the eave', () => {
    // All samples flush with the eave — should fall through to the
    // existing box / extruded-footprint path. We verify this by checking
    // that the top of the geometry is flat at +h/2 (no spike).
    const flatProfile = [2.8, 2.8, 2.8, 2.8, 2.8];
    const geom = wallBaseGeometryForCsg(6, 2.8, 0.2, undefined, flatProfile);
    const box = new THREE.Box3().setFromBufferAttribute(
      geom.getAttribute('position') as THREE.BufferAttribute,
    );
    expect(box.max.y).toBeCloseTo(1.4, 5);
  });
});

describe('diagnoseWallHostedCutRenderRisks — gable-host vertical extent (issue #109)', () => {
  function gableHostWall(): Extract<Element, { kind: 'wall' }> {
    return {
      kind: 'wall',
      id: 'gable-wall',
      name: 'South gable',
      levelId: 'level-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 6000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
      roofAttachmentId: 'roof-1',
    };
  }
  function plainWall(): Extract<Element, { kind: 'wall' }> {
    return {
      kind: 'wall',
      id: 'plain-wall',
      name: 'Eave wall',
      levelId: 'level-1',
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 6000, yMm: 0 },
      thicknessMm: 200,
      heightMm: 2800,
    };
  }
  function gableWindow(
    overrides: Partial<Extract<Element, { kind: 'window' }>> = {},
  ): Extract<Element, { kind: 'window' }> {
    // Window whose head reaches into the gable triangle (sill 2.6 m,
    // head 4.6 m). For a 2.8 m rectangular wall this used to trip the
    // vertical-extent diagnostic; with issue #109 it should be allowed
    // for the gable host and still flagged for the plain wall.
    return {
      kind: 'window',
      id: 'giebel-window',
      name: 'Giebelfenster',
      wallId: 'gable-wall',
      alongT: 0.5,
      widthMm: 1800,
      sillHeightMm: 2600,
      heightMm: 2000,
      ...overrides,
    };
  }

  function codes(elements: Element[]): WallHostedCutRenderDiagnosticCode[] {
    return diagnoseWallHostedCutRenderRisks({ elements }).map((finding) => finding.code);
  }

  it('allows a window whose head crosses the eave when the host wall is roof-attached', () => {
    expect(codes([gableHostWall(), gableWindow()])).not.toContain(
      'hosted_cut_vertical_extent_outside_host',
    );
  });

  it('still flags a window above the eave when the host wall has no roof attachment', () => {
    expect(codes([plainWall(), gableWindow({ wallId: 'plain-wall' })])).toContain(
      'hosted_cut_vertical_extent_outside_host',
    );
  });

  it('still flags inverted extents (head <= sill) on a gable wall (real authoring bug)', () => {
    expect(codes([gableHostWall(), gableWindow({ sillHeightMm: 3000, heightMm: -500 })])).toContain(
      'hosted_cut_vertical_extent_outside_host',
    );
  });
});
