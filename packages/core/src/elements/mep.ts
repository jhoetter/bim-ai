import type { XY } from '../index';
import type { DisciplineTag } from '../index';
import type { AgentTrace } from '../modelContracts';

export type PipeElement = {
  kind: 'pipe';
  id: string;
  name?: string | null;
  levelId: string;
  startMm: XY;
  endMm: XY;
  diameterMm?: number;
  elevationMm?: number | null;
  materialKey?: string | null;
  systemType?: string | null;
  systemName?: string | null;
  flowDirection?: string | null;
  serviceLevel?: string | null;
  insulation?: Record<string, unknown> | null;
  connectors?: Record<string, unknown>[];
  clearanceZone?: Record<string, unknown> | null;
  maintainAccessZone?: Record<string, unknown> | null;
  agentTrace?: AgentTrace;
  optionSetId?: string | null;
  optionId?: string | null;
  discipline?: DisciplineTag | string | null;
};

export type DuctElement = {
  kind: 'duct';
  id: string;
  name?: string | null;
  levelId: string;
  startMm: XY;
  endMm: XY;
  widthMm?: number;
  heightMm?: number;
  shape?: string | null;
  elevationMm?: number | null;
  systemType?: string | null;
  systemName?: string | null;
  flowDirection?: string | null;
  serviceLevel?: string | null;
  insulation?: Record<string, unknown> | null;
  connectors?: Record<string, unknown>[];
  clearanceZone?: Record<string, unknown> | null;
  maintainAccessZone?: Record<string, unknown> | null;
  agentTrace?: AgentTrace;
  optionSetId?: string | null;
  optionId?: string | null;
  discipline?: DisciplineTag | string | null;
};

export type PipeLegendElement = {
  kind: 'pipe_legend';
  id: string;
  title?: string;
  hostViewId?: string | null;
  positionMm?: XY;
  entries?: Record<string, unknown>[];
  discipline?: DisciplineTag | string | null;
};

export type DuctLegendElement = {
  kind: 'duct_legend';
  id: string;
  title?: string;
  hostViewId?: string | null;
  positionMm?: XY;
  entries?: Record<string, unknown>[];
  discipline?: DisciplineTag | string | null;
};

export type CableTrayElement = {
  kind: 'cable_tray';
  id: string;
  name?: string | null;
  levelId: string;
  startMm: XY;
  endMm: XY;
  widthMm?: number;
  heightMm?: number | null;
  elevationMm?: number | null;
  systemType?: string | null;
  systemName?: string | null;
  discipline?: DisciplineTag | string | null;
  agentTrace?: AgentTrace;
  optionSetId?: string | null;
  optionId?: string | null;
};

export type MepEquipmentElement = {
  kind: 'mep_equipment';
  id: string;
  name?: string | null;
  levelId: string;
  positionMm: XY;
  equipmentType?: string | null;
  familyTypeId?: string | null;
  elevationMm?: number | null;
  electricalLoadW?: number | null;
  systemType?: string | null;
  systemName?: string | null;
  discipline?: DisciplineTag | string | null;
  agentTrace?: AgentTrace;
  optionSetId?: string | null;
  optionId?: string | null;
  [key: string]: unknown;
};

export type MepTerminalElement = {
  kind: 'mep_terminal';
  id: string;
  name?: string | null;
  levelId: string;
  positionMm: XY;
  terminalKind?: string | null;
  roomId?: string | null;
  systemType?: string | null;
  systemName?: string | null;
  flowDirection?: string | null;
  discipline?: DisciplineTag | string | null;
  agentTrace?: AgentTrace;
  optionSetId?: string | null;
  optionId?: string | null;
};

export type FixtureElement = {
  kind: 'fixture';
  id: string;
  name?: string | null;
  levelId: string;
  positionMm: XY;
  fixtureType?: string | null;
  roomId?: string | null;
  electricalLoadW?: number | null;
  systemType?: string | null;
  systemName?: string | null;
  discipline?: DisciplineTag | string | null;
  agentTrace?: AgentTrace;
  optionSetId?: string | null;
  optionId?: string | null;
};

export type MepOpeningRequestElement = {
  kind: 'mep_opening_request';
  id: string;
  name?: string | null;
  hostElementId: string;
  levelId?: string | null;
  openingKind?: string | null;
  status?: string | null;
  widthMm?: number | null;
  heightMm?: number | null;
  diameterMm?: number | null;
  clearanceMm?: number | null;
  requesterElementIds?: string[];
  approvalNote?: string | null;
  requestedBy?: string | null;
  discipline?: DisciplineTag | string | null;
  agentTrace?: AgentTrace;
  optionSetId?: string | null;
  optionId?: string | null;
};
