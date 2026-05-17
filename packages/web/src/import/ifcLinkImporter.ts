/** §12.1.1 — IFC Link importer: parse IFC STEP and create a link_ifc element. */

import { parseIfcStep } from './ifcParser';
import { convertIfcToElements } from './ifcImportConverter';
import type { Element } from '@bim-ai/core';

type LinkIfcEl = Extract<Element, { kind: 'link_ifc' }>;

/**
 * Parses an IFC STEP string and creates a link_ifc element.
 */
export function createIfcLink(name: string, ifcContent: string): LinkIfcEl {
  const entities = parseIfcStep(ifcContent);
  const linkedElements = convertIfcToElements(entities);
  return {
    kind: 'link_ifc',
    id: crypto.randomUUID(),
    name,
    ifcContent,
    linkedElements,
    visible: true,
    pinned: false,
  };
}

/**
 * Applies an offset to all linked element positions.
 */
export function applyIfcLinkOffset(
  link: LinkIfcEl,
  offsetMm: { xMm: number; yMm: number; zMm: number },
): LinkIfcEl {
  return { ...link, offsetMm };
}
