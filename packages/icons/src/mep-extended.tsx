/**
 * MEP extended icons — additional Revit-equivalent MEP elements.
 *
 * Covers flex duct/pipe, fittings, accessories, insulation, linings,
 * electrical devices, systems, and valves.
 */
import { bimIcon } from './icon';

// ── Flex duct: corrugated flexible duct — wavy top and bottom walls ───────────
export const FlexDuctIcon = bimIcon(
  'FlexDuctIcon',
  <path d="M2 9C4 7 6 9 8 9S12 7 14 9S18 7 20 9 M2 15C4 17 6 15 8 15S12 17 14 15S18 17 20 15" />,
);

// ── Duct fitting: T-branch fitting — straight duct with upward branch ─────────
export const DuctFittingIcon = bimIcon(
  'DuctFittingIcon',
  <path d="M2 9H22V15H2z M10 4H14V9H10z" />,
);

// ── Duct accessory: fire damper — duct section with crossing damper blades ────
export const DuctAccessoryIcon = bimIcon(
  'DuctAccessoryIcon',
  <path d="M2 9H22V15H2z M7 9L17 15 M17 9L7 15" />,
);

// ── Duct insulation: duct with outer insulation layer (dashed border) ─────────
export const DuctInsulationIcon = bimIcon(
  'DuctInsulationIcon',
  <>
    <path d="M5 10H19V14H5z" />
    <path d="M2 7H22V17H2z" strokeDasharray="3 2" />
  </>,
);

// ── Duct lining: duct with interior acoustic/thermal liner ───────────────────
export const DuctLiningIcon = bimIcon('DuctLiningIcon', <path d="M2 8H22V16H2z M5 10H19V14H5z" />);

// ── Flex pipe: corrugated flexible pipe hose ─────────────────────────────────
export const FlexPipeIcon = bimIcon(
  'FlexPipeIcon',
  <path d="M2 12C4 9 6 15 8 12S12 9 14 12S18 9 20 12" />,
);

// ── Pipe fitting: T-branch junction for pipework ─────────────────────────────
export const PipeFittingIcon = bimIcon(
  'PipeFittingIcon',
  <path d="M2 12H22 M12 4V12 M2 10V14 M22 10V14 M10 4H14" />,
);

// ── Pipe accessory: inline check valve — butterfly X in pipe ─────────────────
export const PipeAccessoryIcon = bimIcon(
  'PipeAccessoryIcon',
  <path d="M2 12H8 M16 12H22 M8 9L12 12L8 15 M16 9L12 12L16 15" />,
);

// ── Pipe insulation: pipe with outer insulation layer (dashed border) ─────────
export const PipeInsulationIcon = bimIcon(
  'PipeInsulationIcon',
  <>
    <path d="M5 11H19V13H5z" />
    <path d="M2 9H22V15H2z" strokeDasharray="3 2" />
  </>,
);

// ── Cable tray fitting: L-junction for cable tray ────────────────────────────
export const CableTrayFittingIcon = bimIcon(
  'CableTrayFittingIcon',
  <path d="M2 9H13V15H2z M13 9H21V12H13" />,
);

// ── Conduit fitting: 90° conduit elbow ───────────────────────────────────────
export const ConduitFittingIcon = bimIcon(
  'ConduitFittingIcon',
  <>
    <circle cx="6" cy="12" r="4" />
    <circle cx="18" cy="18" r="4" />
    <path d="M10 12Q14 12 14 16" />
  </>,
);

// ── Electrical wire: conductors with insulation sheath — cross-section ────────
export const ElectricalWireIcon = bimIcon(
  'ElectricalWireIcon',
  <>
    <circle cx="12" cy="12" r="7" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

// ── Switch system: electrical circuit switch — open-circuit symbol ────────────
export const SwitchSystemIcon = bimIcon(
  'SwitchSystemIcon',
  <path d="M4 12H10 M10 12L18 6 M18 12H20" />,
);

// ── Lighting switch: wall switch plate with rocker ───────────────────────────
export const LightingSwitchIcon = bimIcon(
  'LightingSwitchIcon',
  <path d="M8 4H16V20H8z M10 9H14 M10 14H14" />,
);

// ── Communication device: data/IT device with signal arcs ────────────────────
export const CommunicationDeviceIcon = bimIcon(
  'CommunicationDeviceIcon',
  <>
    <path d="M5 7H15V17H5z" />
    <path d="M17 9A4 4 0 0 1 17 15" />
    <path d="M19 7A6 6 0 0 1 19 17" />
  </>,
);

// ── Fire alarm device: alarm with exclamation — filled circle + ─────────────
export const FireAlarmDeviceIcon = bimIcon(
  'FireAlarmDeviceIcon',
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 8V13" />
    <circle cx="12" cy="16" r="1" />
  </>,
);

// ── Data device: network data outlet ─────────────────────────────────────────
export const DataDeviceIcon = bimIcon(
  'DataDeviceIcon',
  <path d="M5 6H19V18H5z M8 10H16 M8 13H16 M8 16H12" />,
);

// ── Nurse call: call station with pendant cord ────────────────────────────────
export const NurseCallIcon = bimIcon(
  'NurseCallIcon',
  <>
    <circle cx="12" cy="9" r="5" />
    <path d="M12 14V18 M9 18H15" />
  </>,
);

// ── Security device: CCTV camera — body with lens angle ──────────────────────
export const SecurityDeviceIcon = bimIcon(
  'SecurityDeviceIcon',
  <path d="M4 8H14V16H4z M14 10L20 8V16L14 14" />,
);

// ── HVAC zone: climate control zone — dashed room boundary + duct terminal ───
export const HVACZoneIcon = bimIcon(
  'HVACZoneIcon',
  <>
    <path d="M4 4H20V20H4z" strokeDasharray="4 2" />
    <path d="M10 10H14V14H10z M12 8V10 M12 14V16 M8 12H10 M14 12H16" />
  </>,
);

// ── Panel schedule: two-column electrical circuit schedule table ──────────────
export const PanelScheduleIcon = bimIcon(
  'PanelScheduleIcon',
  <path d="M3 4H21V20H3z M12 4V20 M3 8H21 M3 12H21 M3 16H21" />,
);

// ── Duct system: branching duct distribution network ─────────────────────────
export const DuctSystemIcon = bimIcon(
  'DuctSystemIcon',
  <path d="M12 3V9 M12 9L5 17 M12 9L19 17 M2 17H8 M16 17H22" />,
);

// ── Piping system: ring main loop with branch takeoffs ───────────────────────
export const PipingSystemIcon = bimIcon(
  'PipingSystemIcon',
  <>
    <path d="M4 8H20V16H4z" />
    <path d="M12 4V8 M20 12H22 M12 16V20 M4 12H2" />
  </>,
);

// ── Valve: gate valve symbol — two opposing triangles in a pipe ───────────────
export const ValveIcon = bimIcon(
  'ValveIcon',
  <path d="M2 12H8 M16 12H22 M8 9L12 12L8 15 M16 9L12 12L16 15" />,
);
