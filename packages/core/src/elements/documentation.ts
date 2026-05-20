export type ViewPlacement = {
  viewId: string;
  minXY: { x: number; y: number };
  size: { x: number; y: number };
  scale?: number;
};

export type SheetMetadata = {
  projectName?: string;
  drawnBy?: string;
  checkedBy?: string;
  date?: string;
  revision?: string;
};

export type Sheet = {
  kind: 'sheet';
  id: string;
  name: string;
  number?: string;
  size?: 'A0' | 'A1' | 'A2' | 'A3';
  orientation?: 'landscape' | 'portrait';
  titleblockTypeId?: string;
  revisionId?: string;
  viewPlacements?: ViewPlacement[];
  metadata?: SheetMetadata;
  brandTemplateId?: string;
  titleBlock?: string | null;
  viewportsMm?: unknown[];
  paperWidthMm?: number;
  paperHeightMm?: number;
  titleblockParameters?: Record<string, string>;
};

export type TokenSlot = {
  name: string;
  xMm: number;
  yMm: number;
  fontSizeMm?: number;
};

export type TitleblockType = {
  kind: 'titleblock_type';
  id: string;
  name: string;
  svgTemplate: string;
  tokenSlots: TokenSlot[];
};

export type WindowLegendView = {
  kind: 'window_legend_view';
  id: string;
  name: string;
  scope: 'all' | 'sheet' | 'project';
  sortBy: 'type' | 'width' | 'count';
  parentSheetId?: string;
};

export type DocumentationElement = Sheet | TitleblockType | WindowLegendView;
