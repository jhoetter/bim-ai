import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Element } from '@bim-ai/core';
import { makeDoorMesh, makeWallMesh, makeWindowMesh, wallPlanOffsetM } from './meshBuilders';

type WallElem = Extract<Element, { kind: 'wall' }>;

const baseWall: WallElem = {
  kind: 'wall',
  id: 'w1',
  name: 'Test wall',
  levelId: 'lvl0',
  start: { xMm: 0, yMm: 0 },
  end: { xMm: 1000, yMm: 0 },
  thicknessMm: 300,
  heightMm: 2800,
};

describe('makeWallMesh — locationLine offset', () => {
  it('wall-centerline: mesh positioned at axis midpoint (no perpendicular offset)', () => {
    const wall: WallElem = { ...baseWall, locationLine: 'wall-centerline' };
    const mesh = makeWallMesh(wall, 0, null);
    expect(mesh.position.x).toBeCloseTo(0.5, 5);
    expect(mesh.position.z).toBeCloseTo(0, 5);
  });

  it('no locationLine: defaults to wall-centerline (no offset)', () => {
    const mesh = makeWallMesh(baseWall, 0, null);
    expect(mesh.position.x).toBeCloseTo(0.5, 5);
    expect(mesh.position.z).toBeCloseTo(0, 5);
  });

  it('finish-face-exterior (thicknessMm=300, horizontal wall): mesh Z shifts +0.15 m', () => {
    // Horizontal wall along X: perpendicular is +Z direction
    // locFrac=0.5, thick=0.3 → perpZ = (dx/len)*0.5*0.3 = 0.15
    const wall: WallElem = { ...baseWall, locationLine: 'finish-face-exterior' };
    const mesh = makeWallMesh(wall, 0, null);
    expect(mesh.position.x).toBeCloseTo(0.5, 5);
    expect(mesh.position.z).toBeCloseTo(0.15, 5);
  });

  it('finish-face-interior (thicknessMm=300, horizontal wall): mesh Z shifts -0.15 m', () => {
    const wall: WallElem = { ...baseWall, locationLine: 'finish-face-interior' };
    const mesh = makeWallMesh(wall, 0, null);
    expect(mesh.position.x).toBeCloseTo(0.5, 5);
    expect(mesh.position.z).toBeCloseTo(-0.15, 5);
  });

  it('core-face-exterior: same offset as finish-face-exterior', () => {
    const wall: WallElem = { ...baseWall, locationLine: 'core-face-exterior' };
    const mesh = makeWallMesh(wall, 0, null);
    expect(mesh.position.z).toBeCloseTo(0.15, 5);
  });

  it('core-centerline: no offset (treated as wall-centerline)', () => {
    const wall: WallElem = { ...baseWall, locationLine: 'core-centerline' };
    const mesh = makeWallMesh(wall, 0, null);
    expect(mesh.position.z).toBeCloseTo(0, 5);
  });

  it('baseConstraintOffsetMm shifts mesh Y position', () => {
    const wall: WallElem = { ...baseWall, baseConstraintOffsetMm: 500 };
    const mesh = makeWallMesh(wall, 0, null);
    // yBase = 0 + 0.5 = 0.5, height = 2.8, y = 0.5 + 2.8/2 = 1.9
    expect(mesh.position.y).toBeCloseTo(0.5 + 2.8 / 2, 3);
  });

  it('topConstraintLevelId adjusts wall height', () => {
    const topLevel: Extract<Element, { kind: 'level' }> = {
      kind: 'level',
      id: 'lvl1',
      name: 'Level 1',
      elevationMm: 3000,
    };
    const elementsById: Record<string, Element> = { lvl1: topLevel };
    const wall: WallElem = {
      ...baseWall,
      topConstraintLevelId: 'lvl1',
      topConstraintOffsetMm: 0,
    };
    // elevM=0, baseOff=0, yBase=0; topElevM=3, topOff=0 → height=3-0=3
    const mesh = makeWallMesh(wall, 0, null, elementsById);
    expect(mesh.position.y).toBeCloseTo(0 + 3 / 2, 5);
  });

  it('diagonal wall mesh local X axis follows the authored start-to-end line', () => {
    const wall: WallElem = {
      ...baseWall,
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 3000, yMm: 4000 },
    };
    const mesh = makeWallMesh(wall, 0, null) as THREE.Mesh;
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(mesh.quaternion);
    const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);

    expect(localX.x).toBeCloseTo(0.6, 5);
    expect(localX.z).toBeCloseTo(0.8, 5);
    expect(localZ.x).toBeCloseTo(-0.8, 5);
    expect(localZ.z).toBeCloseTo(0.6, 5);
  });

  it('hosted door and window use the same diagonal frame as their host wall', () => {
    const wall: WallElem = {
      ...baseWall,
      start: { xMm: 0, yMm: 0 },
      end: { xMm: 3000, yMm: 4000 },
      thicknessMm: 300,
      locationLine: 'finish-face-exterior',
    };
    const door: Extract<Element, { kind: 'door' }> = {
      kind: 'door',
      id: 'door-1',
      name: 'Door',
      wallId: wall.id,
      alongT: 0.25,
      widthMm: 900,
    };
    const win: Extract<Element, { kind: 'window' }> = {
      kind: 'window',
      id: 'window-1',
      name: 'Window',
      wallId: wall.id,
      alongT: 0.75,
      widthMm: 1200,
      heightMm: 1500,
      sillHeightMm: 900,
    };
    const wallMesh = makeWallMesh(wall, 0, null) as THREE.Mesh;
    const doorMesh = makeDoorMesh(door, wall, 0, null);
    const windowMesh = makeWindowMesh(win, wall, 0, null);
    const offset = wallPlanOffsetM(wall);

    for (const hosted of [doorMesh, windowMesh]) {
      expect(hosted.rotation.y).toBeCloseTo(wallMesh.rotation.y, 5);
      const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(hosted.quaternion);
      const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(hosted.quaternion);
      expect(localX.x).toBeCloseTo(0.6, 5);
      expect(localX.z).toBeCloseTo(0.8, 5);
      expect(localZ.x).toBeCloseTo(-0.8, 5);
      expect(localZ.z).toBeCloseTo(0.6, 5);
    }

    expect(doorMesh.position.x).toBeCloseTo(0.75 + offset.xM, 5);
    expect(doorMesh.position.z).toBeCloseTo(1 + offset.zM, 5);
    expect(windowMesh.position.x).toBeCloseTo(2.25 + offset.xM, 5);
    expect(windowMesh.position.z).toBeCloseTo(3 + offset.zM, 5);
  });
});
