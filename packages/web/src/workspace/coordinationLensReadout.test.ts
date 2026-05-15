import { describe, expect, it } from 'vitest';
import type { Element } from '@bim-ai/core';

import { buildCoordinationLensReadout } from './coordinationLensReadout';

describe('buildCoordinationLensReadout', () => {
  it('rolls up health, clash, issue, link, and review artifact counts', () => {
    const elementsById = {
      issue: {
        kind: 'issue',
        id: 'issue',
        title: 'Missing host',
        status: 'open',
        severity: 'error',
        responsibleDiscipline: 'architecture',
        elementIds: ['door-missing'],
      },
      clash: {
        kind: 'clash_test',
        id: 'clash',
        name: 'A vs B',
        setAIds: [],
        setBIds: [],
        toleranceMm: 0,
        results: [{ elementIdA: 'wall-1', elementIdB: 'duct-1', distanceMm: 0 }],
      },
      link: {
        kind: 'link_external',
        id: 'link',
        name: 'Coordination IFC',
        externalLinkType: 'ifc',
        sourcePath: '/coordination.ifc',
        reloadStatus: 'source_missing',
      },
      bcf: {
        kind: 'bcf',
        id: 'bcf',
        title: 'Viewpoint',
        elementIds: ['wall-1'],
      },
    } as unknown as Record<string, Element>;

    const readout = buildCoordinationLensReadout(elementsById);

    expect(readout.modelHealthWarningCount).toBe(3);
    expect(readout.clashCount).toBe(1);
    expect(readout.openIssueCount).toBe(1);
    expect(readout.linkedModelCount).toBe(1);
    expect(readout.reviewArtifactCount).toBe(1);
    expect(readout.requiredSchedules).toContain('Linked model drift report');
    expect(readout.issues[0]).toMatchObject({
      id: 'issue',
      title: 'Missing host',
      severity: 'error',
      responsibleDiscipline: 'architecture',
    });
  });
});
