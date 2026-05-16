// Core data model for model groups (B2 workpackage).

// A named group definition — defines the elements and their local-space positions
export interface GroupDefinition {
  id: string;
  name: string;
  elementIds: string[];
  originXMm: number; // world coords of the group's local origin when it was created
  originYMm: number;
}

// A placed instance of a group definition
export interface GroupInstance {
  id: string;
  groupDefinitionId: string;
  insertionXMm: number;
  insertionYMm: number;
  rotationDeg: number;
}

// Project-level group registry
export interface GroupRegistry {
  definitions: Record<string, GroupDefinition>;
  instances: Record<string, GroupInstance>;
}

export function emptyGroupRegistry(): GroupRegistry {
  return { definitions: {}, instances: {} };
}
