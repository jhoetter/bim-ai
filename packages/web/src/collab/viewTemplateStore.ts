import { create } from 'zustand';
import type { ViewTemplate, ViewTemplatePropagation } from '@bim-ai/core';
import { applyCommand } from '../lib/api';

type ViewTemplateState = {
  templates: ViewTemplate[];
  lastPropagation: ViewTemplatePropagation | null;
  createTemplate: (
    modelId: string,
    templateId: string,
    name: string,
    opts?: {
      scale?: number;
      detailLevel?: 'coarse' | 'medium' | 'fine';
      phase?: string;
      phaseFilter?: string;
    },
  ) => Promise<void>;
  updateTemplate: (
    modelId: string,
    templateId: string,
    patch: {
      name?: string;
      scale?: number;
      detailLevel?: 'coarse' | 'medium' | 'fine';
      phase?: string;
      phaseFilter?: string;
    },
  ) => Promise<void>;
  applyTemplate: (modelId: string, viewId: string, templateId: string) => Promise<void>;
  unbindTemplate: (modelId: string, viewId: string) => Promise<void>;
  deleteTemplate: (modelId: string, templateId: string) => Promise<void>;
  dismissPropagation: () => void;
  syncFromElements: (elements: Record<string, unknown>) => void;
};

function extractPropagation(resp: unknown): ViewTemplatePropagation | null {
  if (!resp || typeof resp !== 'object') return null;
  const r = resp as Record<string, unknown>;
  const p = r.viewTemplatePropagation;
  if (!p || typeof p !== 'object') return null;
  const pr = p as Record<string, unknown>;
  if (pr.event !== 'ViewTemplatePropagation') return null;
  return p as ViewTemplatePropagation;
}

function extractTemplatesFromElements(elements: Record<string, unknown>): ViewTemplate[] {
  return Object.values(elements)
    .filter(
      (e): e is ViewTemplate =>
        typeof e === 'object' &&
        e !== null &&
        (e as Record<string, unknown>).kind === 'view_template',
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const useViewTemplateStore = create<ViewTemplateState>((set) => ({
  templates: [],
  lastPropagation: null,

  async createTemplate(modelId, templateId, name, opts = {}) {
    const resp = await applyCommand(modelId, {
      type: 'CreateViewTemplate',
      templateId,
      name,
      ...(opts.scale != null ? { scale: opts.scale } : {}),
      ...(opts.detailLevel ? { detailLevel: opts.detailLevel } : {}),
      ...(opts.phase ? { phase: opts.phase } : {}),
      ...(opts.phaseFilter ? { phaseFilter: opts.phaseFilter } : {}),
    });
    if (resp.elements) {
      set({ templates: extractTemplatesFromElements(resp.elements) });
    }
  },

  async updateTemplate(modelId, templateId, patch) {
    const resp = await applyCommand(modelId, {
      type: 'UpdateViewTemplate',
      templateId,
      ...patch,
    });
    if (resp.elements) {
      set({ templates: extractTemplatesFromElements(resp.elements) });
    }
    const prop = extractPropagation(resp);
    if (prop) set({ lastPropagation: prop });
  },

  async applyTemplate(modelId, viewId, templateId) {
    const resp = await applyCommand(modelId, {
      type: 'ApplyViewTemplate',
      viewId,
      templateId,
    });
    if (resp.elements) {
      set({ templates: extractTemplatesFromElements(resp.elements) });
    }
    const prop = extractPropagation(resp);
    if (prop) set({ lastPropagation: prop });
  },

  async unbindTemplate(modelId, viewId) {
    const resp = await applyCommand(modelId, {
      type: 'UnbindViewTemplate',
      viewId,
    });
    if (resp.elements) {
      set({ templates: extractTemplatesFromElements(resp.elements) });
    }
    const prop = extractPropagation(resp);
    if (prop) set({ lastPropagation: prop });
  },

  async deleteTemplate(modelId, templateId) {
    const resp = await applyCommand(modelId, {
      type: 'DeleteViewTemplate',
      templateId,
    });
    if (resp.elements) {
      set({ templates: extractTemplatesFromElements(resp.elements) });
    }
    const prop = extractPropagation(resp);
    if (prop) set({ lastPropagation: prop });
  },

  dismissPropagation() {
    set({ lastPropagation: null });
  },

  syncFromElements(elements) {
    set({ templates: extractTemplatesFromElements(elements) });
  },
}));
