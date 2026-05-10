import type { Element } from '@bim-ai/core';
import type { InspectorPropertiesContext } from './inspector';

const TYPE_CONTEXT_KINDS = new Set<Element['kind']>([
  'family_type',
  'wall_type',
  'floor_type',
  'roof_type',
]);

const VIEW_CONTEXT_KINDS = new Set<Element['kind']>([
  'plan_view',
  'viewpoint',
  'section_cut',
  'sheet',
  'schedule',
  'view_template',
]);

export function inspectorPropertiesContextForElement(
  element: Element | undefined,
): InspectorPropertiesContext {
  if (!element) return 'properties';
  if (TYPE_CONTEXT_KINDS.has(element.kind)) return 'type';
  if (VIEW_CONTEXT_KINDS.has(element.kind)) return 'view';
  return 'instance';
}
