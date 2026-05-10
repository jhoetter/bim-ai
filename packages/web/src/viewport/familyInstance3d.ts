import * as THREE from 'three';
import type { Element } from '@bim-ai/core';

import { resolveFamilyGeometry, type HostParams } from '../families/familyResolver';
import { familyDefinitionForType } from '../plan/familyInstancePlanRendering';

type FamilyInstanceElement = Extract<Element, { kind: 'family_instance' }>;

export function makeFamilyInstanceMesh(
  instance: FamilyInstanceElement,
  elementsById: Record<string, Element>,
): THREE.Group | null {
  const type = elementsById[instance.familyTypeId];
  if (type?.kind !== 'family_type') return null;
  const def = familyDefinitionForType(type);
  if (!def?.geometry?.length) return null;
  const group = resolveFamilyGeometry(
    def.id,
    { ...type.parameters, ...(instance.paramValues ?? {}) } as HostParams,
    { [def.id]: def },
  );
  const level = instance.levelId ? elementsById[instance.levelId] : undefined;
  const elevM = level?.kind === 'level' ? level.elevationMm / 1000 : 0;
  let xMm = instance.positionMm.xMm;
  let yMm = instance.positionMm.yMm;
  let rotationDeg = instance.rotationDeg ?? 0;
  const host = instance.hostElementId ? elementsById[instance.hostElementId] : undefined;
  if (host?.kind === 'wall' && instance.hostAlongT != null) {
    const t = Math.max(0, Math.min(1, instance.hostAlongT));
    const dx = host.end.xMm - host.start.xMm;
    const dy = host.end.yMm - host.start.yMm;
    xMm = host.start.xMm + dx * t;
    yMm = host.start.yMm + dy * t;
    rotationDeg += (Math.atan2(dy, dx) * 180) / Math.PI;
  }
  group.scale.set(0.001, 0.001, 0.001);
  group.position.set(xMm / 1000, elevM, yMm / 1000);
  group.rotation.y = -THREE.MathUtils.degToRad(rotationDeg);
  group.userData.bimPickId = instance.id;
  group.userData.familyTypeId = instance.familyTypeId;
  return group;
}
