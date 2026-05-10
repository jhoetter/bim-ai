import type {
  AuthoredFamilyCategory,
  AuthoredFamilyTemplate,
  AuthoredFamilyTemplateHostType,
  AuthoredFamilyTemplateMetadata,
} from './familyEditorPersistence';

export interface FamilyTemplateBrowserEntry {
  id: AuthoredFamilyTemplate;
  label: string;
  fileName: string;
  browserPath: string;
  category: AuthoredFamilyCategory;
  categoryLabel: string;
  hostType: AuthoredFamilyTemplateHostType;
  hostLabel: string;
  description: string;
  tags: string[];
  defaultAlwaysVertical: boolean;
  defaultWorkPlaneBased: boolean;
  defaultRoomCalculationPoint: boolean;
  defaultShared: boolean;
}

export const FAMILY_TEMPLATE_BROWSER_ENTRIES: FamilyTemplateBrowserEntry[] = [
  {
    id: 'generic_model',
    label: 'Generic Model',
    fileName: 'Metric Generic Model.rft',
    browserPath: 'Templates/Family Templates/English/Metric Generic Model.rft',
    category: 'generic_model',
    categoryLabel: 'Generic Models',
    hostType: 'standalone',
    hostLabel: 'Standalone',
    description: 'Non-hosted model family for components that place directly in a project.',
    tags: ['generic', 'component', 'model', 'standalone'],
    defaultAlwaysVertical: false,
    defaultWorkPlaneBased: false,
    defaultRoomCalculationPoint: false,
    defaultShared: false,
  },
  {
    id: 'door',
    label: 'Door',
    fileName: 'Metric Door.rft',
    browserPath: 'Templates/Family Templates/English/Metric Door.rft',
    category: 'door',
    categoryLabel: 'Doors',
    hostType: 'wall_hosted',
    hostLabel: 'Wall-hosted',
    description: 'Wall-hosted opening family with Door category metadata.',
    tags: ['door', 'opening', 'wall', 'hosted'],
    defaultAlwaysVertical: true,
    defaultWorkPlaneBased: false,
    defaultRoomCalculationPoint: true,
    defaultShared: false,
  },
  {
    id: 'window',
    label: 'Window',
    fileName: 'Metric Window.rft',
    browserPath: 'Templates/Family Templates/English/Metric Window.rft',
    category: 'window',
    categoryLabel: 'Windows',
    hostType: 'wall_hosted',
    hostLabel: 'Wall-hosted',
    description: 'Wall-hosted opening family with Window category metadata.',
    tags: ['window', 'opening', 'wall', 'hosted'],
    defaultAlwaysVertical: true,
    defaultWorkPlaneBased: false,
    defaultRoomCalculationPoint: false,
    defaultShared: false,
  },
  {
    id: 'profile',
    label: 'Profile',
    fileName: 'Metric Profile.rft',
    browserPath: 'Templates/Family Templates/English/Metric Profile.rft',
    category: 'profile',
    categoryLabel: 'Profiles',
    hostType: 'profile_based',
    hostLabel: 'Profile-based',
    description: '2D profile family for sweeps, reveals, and hosted profile consumers.',
    tags: ['profile', 'sweep', 'reveal', '2d'],
    defaultAlwaysVertical: false,
    defaultWorkPlaneBased: true,
    defaultRoomCalculationPoint: false,
    defaultShared: false,
  },
  {
    id: 'furniture',
    label: 'Furniture',
    fileName: 'Metric Furniture.rft',
    browserPath: 'Templates/Family Templates/English/Metric Furniture.rft',
    category: 'furniture',
    categoryLabel: 'Furniture',
    hostType: 'standalone',
    hostLabel: 'Standalone',
    description: 'Level-placed furniture family with origin planes and starter type defaults.',
    tags: ['furniture', 'chair', 'level', 'standalone', 'component'],
    defaultAlwaysVertical: false,
    defaultWorkPlaneBased: false,
    defaultRoomCalculationPoint: false,
    defaultShared: false,
  },
];

export function getFamilyTemplateBrowserEntry(
  id: AuthoredFamilyTemplate,
): FamilyTemplateBrowserEntry {
  return (
    FAMILY_TEMPLATE_BROWSER_ENTRIES.find((entry) => entry.id === id) ??
    FAMILY_TEMPLATE_BROWSER_ENTRIES[0]!
  );
}

export function buildFamilyTemplateMetadata(
  entry: FamilyTemplateBrowserEntry,
  options: {
    originReferencePlaneIds?: string[];
    referencePlaneIds?: string[];
    defaultTypeNames?: string[];
  } = {},
): AuthoredFamilyTemplateMetadata {
  return {
    templateId: entry.id,
    fileName: entry.fileName,
    browserPath: entry.browserPath,
    displayName: entry.label,
    category: entry.category,
    categoryLabel: entry.categoryLabel,
    hostType: entry.hostType,
    hostLabel: entry.hostLabel,
    originReferencePlaneIds: options.originReferencePlaneIds ?? [],
    referencePlaneIds: options.referencePlaneIds ?? [],
    defaultTypeNames: options.defaultTypeNames ?? [],
  };
}

export function filterFamilyTemplateBrowserEntries(
  entries: FamilyTemplateBrowserEntry[],
  filters: {
    query?: string;
    hostType?: AuthoredFamilyTemplateHostType | 'all';
    category?: AuthoredFamilyCategory | 'all';
  },
): FamilyTemplateBrowserEntry[] {
  const query = filters.query?.trim().toLowerCase() ?? '';
  return entries.filter((entry) => {
    if (filters.hostType && filters.hostType !== 'all' && entry.hostType !== filters.hostType) {
      return false;
    }
    if (filters.category && filters.category !== 'all' && entry.category !== filters.category) {
      return false;
    }
    if (!query) return true;
    const haystack = [
      entry.label,
      entry.fileName,
      entry.browserPath,
      entry.categoryLabel,
      entry.hostLabel,
      entry.description,
      ...entry.tags,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}
