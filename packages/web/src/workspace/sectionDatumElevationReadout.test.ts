import { describe, expect, it } from 'vitest';

import { formatSectionDatumElevationEvidenceLine } from './sectionDatumElevationReadout';

describe('sectionDatumElevationReadout', () => {
  it('formats payload', () => {
    const line = formatSectionDatumElevationEvidenceLine({
      sectionDatumElevationEvidence_v0: {
        format: 'sectionDatumElevationEvidence_v0',
        gridCrossingCount: 2,
        levelMarkerCount: 3,
      },
    });
    expect(line).toContain('gridCrossings=2');
  });
});
