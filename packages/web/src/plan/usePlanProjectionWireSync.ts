import { useEffect } from 'react';

import type { PlanRoomSchemeWireReadout } from '../state/storeTypes';
import {
  buildPlanProjectionQuery,
  extractPlanAnnotationHints,
  extractPlanCategoryGraphicHintsV0,
  extractPlanGraphicHints,
  extractPlanPrimitives,
  extractPlanTagStyleHints,
  extractRoomColorLegend,
  extractRoomProgrammeLegendEvidenceV0,
  fetchPlanProjectionWire,
  type PlanProjectionPrimitivesV1Wire,
  type PlanRoomColorLegendRow,
} from './planProjectionWire';

type Input = {
  modelId?: string | null;
  revision: number;
  planViewId?: string | null;
  fallbackLevelId?: string | null;
  planPresentation: string;
  setPlanProjectionPrimitives: (value: PlanProjectionPrimitivesV1Wire | null) => void;
  setPlanRoomSchemeWireReadout: (value: PlanRoomSchemeWireReadout | null) => void;
  setRoomColorLegend: (rows: PlanRoomColorLegendRow[]) => void;
  setWireGraphicHints: (value: ReturnType<typeof extractPlanGraphicHints> | null) => void;
  setWireAnnotationHints: (value: ReturnType<typeof extractPlanAnnotationHints> | null) => void;
  setWireTagStyleHints: (value: ReturnType<typeof extractPlanTagStyleHints> | null) => void;
};

type InflightPlanProjection = {
  controller: AbortController;
  promise: Promise<Record<string, unknown>>;
  consumers: number;
};

const inflightPlanProjectionRequests = new Map<string, InflightPlanProjection>();

function acquirePlanProjectionRequest(
  key: string,
  modelId: string,
  qs: URLSearchParams,
): { promise: Promise<Record<string, unknown>>; release: () => void } {
  let entry = inflightPlanProjectionRequests.get(key);
  if (!entry) {
    const controller = new AbortController();
    const promise = fetchPlanProjectionWire(modelId, qs, { signal: controller.signal }).finally(
      () => {
        if (inflightPlanProjectionRequests.get(key)?.promise === promise) {
          inflightPlanProjectionRequests.delete(key);
        }
      },
    );
    entry = { controller, promise, consumers: 0 };
    inflightPlanProjectionRequests.set(key, entry);
  }
  entry.consumers += 1;
  return {
    promise: entry.promise,
    release: () => {
      const current = inflightPlanProjectionRequests.get(key);
      if (!current) return;
      current.consumers -= 1;
      if (current.consumers <= 0) {
        current.controller.abort();
        inflightPlanProjectionRequests.delete(key);
      }
    },
  };
}

export function usePlanProjectionWireSync({
  modelId,
  revision,
  planViewId,
  fallbackLevelId,
  planPresentation,
  setPlanProjectionPrimitives,
  setPlanRoomSchemeWireReadout,
  setRoomColorLegend,
  setWireGraphicHints,
  setWireAnnotationHints,
  setWireTagStyleHints,
}: Input) {
  useEffect(() => {
    let cancel = false;
    const clearWire = () => {
      setPlanProjectionPrimitives(null);
      setPlanRoomSchemeWireReadout(null);
      setRoomColorLegend([]);
      setWireGraphicHints(null);
      setWireAnnotationHints(null);
      setWireTagStyleHints(null);
    };

    if (!modelId) {
      queueMicrotask(() => {
        if (!cancel) clearWire();
      });
      return () => {
        cancel = true;
      };
    }

    const qs = buildPlanProjectionQuery({
      planViewId: planViewId ?? undefined,
      fallbackLevelId: planViewId ? undefined : fallbackLevelId || undefined,
      globalPresentation: planPresentation,
    });
    const request = acquirePlanProjectionRequest(
      `${modelId}|${revision}|${qs.toString()}`,
      modelId,
      qs,
    );

    void (async () => {
      try {
        const payload = await request.promise;
        if (cancel) return;
        const legendRows = extractRoomColorLegend(payload);
        setPlanProjectionPrimitives(extractPlanPrimitives(payload));
        setPlanRoomSchemeWireReadout({
          roomColorLegendRows: legendRows,
          programmeLegendEvidence: extractRoomProgrammeLegendEvidenceV0(payload),
          planCategoryGraphicHintsV0: extractPlanCategoryGraphicHintsV0(payload),
        });
        setRoomColorLegend(legendRows);
        setWireGraphicHints(extractPlanGraphicHints(payload));
        setWireAnnotationHints(extractPlanAnnotationHints(payload));
        setWireTagStyleHints(extractPlanTagStyleHints(payload));
      } catch {
        if (!cancel) clearWire();
      }
    })();

    return () => {
      cancel = true;
      request.release();
    };
  }, [
    modelId,
    revision,
    planViewId,
    fallbackLevelId,
    planPresentation,
    setPlanProjectionPrimitives,
    setPlanRoomSchemeWireReadout,
    setRoomColorLegend,
    setWireGraphicHints,
    setWireAnnotationHints,
    setWireTagStyleHints,
  ]);
}
