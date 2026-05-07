/**
 * EDT-01 — beam grip provider.
 *
 * Two endpoint grips. Drag commits a `moveBeamEndpoints` command
 * (added in this WP under app/bim_ai/commands.py for forward
 * compatibility — the engine handler is a stub today since beams
 * are not yet seeded into the Python store, but the protocol shape is
 * locked in so the engine slice can land without a TS rebuild).
 */
import type { Element } from '@bim-ai/core';

import type {
  ElementGripProvider,
  GripCommand,
  GripDescriptor,
  PlanContext,
} from '../gripProtocol';

export type Beam = Extract<Element, { kind: 'beam' }>;

function makeEndpointCommand(
  beam: Beam,
  endpoint: 'start' | 'end',
  next: { xMm: number; yMm: number },
): GripCommand {
  return {
    type: 'moveBeamEndpoints',
    beamId: beam.id,
    startMm: endpoint === 'start' ? next : beam.startMm,
    endMm: endpoint === 'end' ? next : beam.endMm,
  };
}

export const beamGripProvider: ElementGripProvider<Beam> = {
  grips(beam: Beam, _context: PlanContext): GripDescriptor[] {
    const startGrip: GripDescriptor = {
      id: `${beam.id}:start`,
      positionMm: beam.startMm,
      shape: 'square',
      axis: 'free',
      hint: 'Drag beam start endpoint',
      onDrag: () => ({ kind: 'unknown', id: beam.id }),
      onCommit: (delta) =>
        makeEndpointCommand(beam, 'start', {
          xMm: beam.startMm.xMm + delta.xMm,
          yMm: beam.startMm.yMm + delta.yMm,
        }),
      onNumericOverride: (absoluteMm): GripCommand => {
        // Numeric = beam length anchored at end, direction toward start.
        const dirX = beam.startMm.xMm - beam.endMm.xMm;
        const dirY = beam.startMm.yMm - beam.endMm.yMm;
        const len = Math.hypot(dirX, dirY) || 1;
        return makeEndpointCommand(beam, 'start', {
          xMm: beam.endMm.xMm + (dirX / len) * absoluteMm,
          yMm: beam.endMm.yMm + (dirY / len) * absoluteMm,
        });
      },
    };

    const endGrip: GripDescriptor = {
      id: `${beam.id}:end`,
      positionMm: beam.endMm,
      shape: 'square',
      axis: 'free',
      hint: 'Drag beam end endpoint',
      onDrag: () => ({ kind: 'unknown', id: beam.id }),
      onCommit: (delta) =>
        makeEndpointCommand(beam, 'end', {
          xMm: beam.endMm.xMm + delta.xMm,
          yMm: beam.endMm.yMm + delta.yMm,
        }),
      onNumericOverride: (absoluteMm): GripCommand => {
        const dirX = beam.endMm.xMm - beam.startMm.xMm;
        const dirY = beam.endMm.yMm - beam.startMm.yMm;
        const len = Math.hypot(dirX, dirY) || 1;
        return makeEndpointCommand(beam, 'end', {
          xMm: beam.startMm.xMm + (dirX / len) * absoluteMm,
          yMm: beam.startMm.yMm + (dirY / len) * absoluteMm,
        });
      },
    };

    return [startGrip, endGrip];
  },
};
