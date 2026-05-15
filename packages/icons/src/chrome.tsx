/**
 * Generic chrome icons for app navigation, status, menus, and utility buttons.
 *
 * These live in @bim-ai/icons so application chrome does not need third-party
 * icon sets for non-BIM glyphs.
 */
import { bimIcon } from './icon';

export const SelectIcon = bimIcon(
  'SelectIcon',
  <path d="M5 3L18 13L12 14L15 21L12 22L9 15L5 19z" />,
);

export const SearchIcon = bimIcon(
  'SearchIcon',
  <>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5L21 21" />
  </>,
);

export const SettingsIcon = bimIcon(
  'SettingsIcon',
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2V5 M12 19V22 M4.9 4.9L7 7 M17 17L19.1 19.1 M2 12H5 M19 12H22 M4.9 19.1L7 17 M17 7L19.1 4.9" />
  </>,
);

export const MenuIcon = bimIcon('MenuIcon', <path d="M4 7H20 M4 12H20 M4 17H20" />);
export const CloseIcon = bimIcon('CloseIcon', <path d="M6 6L18 18 M18 6L6 18" />);
export const ChevronDownIcon = bimIcon('ChevronDownIcon', <path d="M6 9L12 15L18 9" />);
export const ChevronRightIcon = bimIcon('ChevronRightIcon', <path d="M9 6L15 12L9 18" />);

export const AlertTriangleIcon = bimIcon(
  'AlertTriangleIcon',
  <>
    <path d="M12 3L22 20H2z" />
    <path d="M12 9V14" />
    <path d="M12 17H12.01" />
  </>,
);

export const CameraIcon = bimIcon(
  'CameraIcon',
  <>
    <path d="M4 7H8L10 4H14L16 7H20V19H4z" />
    <circle cx="12" cy="13" r="4" />
  </>,
);

export const CommandPaletteIcon = bimIcon(
  'CommandPaletteIcon',
  <path d="M8 8H6A3 3 0 1 1 9 5V19A3 3 0 1 1 6 16H18A3 3 0 1 1 15 19V5A3 3 0 1 1 18 8z" />,
);

export const ExternalLinkIcon = bimIcon(
  'ExternalLinkIcon',
  <path d="M14 4H20V10 M20 4L11 13 M10 5H5V19H19V14" />,
);

export const VisibilityOnIcon = bimIcon(
  'VisibilityOnIcon',
  <>
    <path d="M2 12C5 7 8.5 5 12 5S19 7 22 12C19 17 15.5 19 12 19S5 17 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const VisibilityOffIcon = bimIcon(
  'VisibilityOffIcon',
  <>
    <path d="M3 3L21 21" />
    <path d="M2 12C3.5 9.5 5.2 7.7 7 6.5 M10.5 5.2C11 5.1 11.5 5 12 5C15.5 5 19 7 22 12C21 13.7 19.9 15.1 18.7 16.1" />
    <path d="M14 14.2A3 3 0 0 1 9.8 10" />
  </>,
);

export const EvidenceIcon = bimIcon(
  'EvidenceIcon',
  <path d="M6 3H15L20 8V21H6z M15 3V8H20 M9 13H15 M9 17H17" />,
);

export const GridIcon = bimIcon(
  'GridIcon',
  <path d="M4 4H20V20H4z M4 9.33H20 M4 14.66H20 M9.33 4V20 M14.66 4V20" />,
);

export const HomeIcon = bimIcon(
  'HomeIcon',
  <path d="M3 11L12 4L21 11 M5 10V20H19V10 M10 20V14H14V20" />,
);

export const LinkIcon = bimIcon(
  'LinkIcon',
  <path d="M9 7H7A5 5 0 0 0 7 17H9 M15 7H17A5 5 0 0 1 17 17H15 M8 12H16" />,
);

export const SnapIcon = bimIcon(
  'SnapIcon',
  <path d="M6 3V10A6 6 0 0 0 18 10V3 M6 7H10 M14 7H18 M9 20H15" />,
);

export const ThinLineIcon = bimIcon('ThinLineIcon', <path d="M5 12H19" />);

export const MoonIcon = bimIcon(
  'MoonIcon',
  <path d="M19 15.5A8 8 0 0 1 8.5 5A8 8 0 1 0 19 15.5z" />,
);

export const SunIcon = bimIcon(
  'SunIcon',
  <>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2V5 M12 19V22 M4.9 4.9L7 7 M17 17L19.1 19.1 M2 12H5 M19 12H22 M4.9 19.1L7 17 M17 7L19.1 4.9" />
  </>,
);

export const UndoIcon = bimIcon('UndoIcon', <path d="M9 7L4 12L9 17 M4 12H15A5 5 0 0 1 15 22" />);
export const RedoIcon = bimIcon('RedoIcon', <path d="M15 7L20 12L15 17 M20 12H9A5 5 0 0 0 9 22" />);

export const AgentIcon = bimIcon(
  'AgentIcon',
  <path d="M12 2L14 9L21 12L14 15L12 22L10 15L3 12L10 9z M18 3L19 6L22 7L19 8L18 11L17 8L14 7L17 6z" />,
);

export const CollaboratorsIcon = bimIcon(
  'CollaboratorsIcon',
  <>
    <circle cx="9" cy="8" r="3" />
    <circle cx="17" cy="10" r="2.5" />
    <path d="M3 20A6 6 0 0 1 15 20 M14 18A5 5 0 0 1 22 18" />
  </>,
);

export const OnlineIcon = bimIcon('OnlineIcon', <circle cx="12" cy="12" r="4" />);

export const DownloadIcon = bimIcon(
  'DownloadIcon',
  <path d="M12 3V15 M8 11L12 15L16 11 M5 19H19" />,
);
export const FocusIcon = bimIcon(
  'FocusIcon',
  <path d="M4 9V4H9 M15 4H20V9 M20 15V20H15 M9 20H4V15 M9 12H15 M12 9V15" />,
);
export const RefreshIcon = bimIcon(
  'RefreshIcon',
  <path d="M20 7V3H16 M20 3L16.5 6.5A7 7 0 1 0 19 12" />,
);
export const MoreHorizontalIcon = bimIcon(
  'MoreHorizontalIcon',
  <path d="M5 12H5.01 M12 12H12.01 M19 12H19.01" />,
);
export const MoreVerticalIcon = bimIcon(
  'MoreVerticalIcon',
  <path d="M12 5H12.01 M12 12H12.01 M12 19H12.01" />,
);
export const CheckIcon = bimIcon('CheckIcon', <path d="M5 12L10 17L20 7" />);
export const ClockIcon = bimIcon(
  'ClockIcon',
  <>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7V12L16 14" />
  </>,
);
