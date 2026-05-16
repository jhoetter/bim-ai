import type { Element } from '@bim-ai/core';

import { exportToDxf } from '../export/dxfExporter';

export function exportSceneToDwg(elementsById: Record<string, Element>): string {
  const views = exportToDxf(elementsById);
  const combined = views.map((v) => v.dxfContent).join('\n');
  const dwgContent = combined.replace(/AC1009/g, 'AC1015');

  try {
    const blob = new Blob([dwgContent], { type: 'application/acad' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'export.dwg';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    // Not available in non-browser environments
  }

  return dwgContent;
}
