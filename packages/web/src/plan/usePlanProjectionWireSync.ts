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

    void (async () => {
      try {
        const qs = buildPlanProjectionQuery({
          planViewId: planViewId ?? undefined,
          fallbackLevelId: planViewId ? undefined : fallbackLevelId || undefined,
          globalPresentation: planPresentation,
        });
        const payload = await fetchPlanProjectionWire(modelId, qs);
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
