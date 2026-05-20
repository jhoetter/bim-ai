import { useCallback, useEffect, useRef, useState } from 'react';

export function useWorkspaceCompositionLoading() {
  const [loadingCompositionId, setLoadingCompositionId] = useState<string | null>(null);
  const loadingCompositionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingTransitionSeqRef = useRef(0);

  const finishCompositionLoadingSoon = useCallback((id: string): void => {
    if (loadingCompositionTimerRef.current) {
      clearTimeout(loadingCompositionTimerRef.current);
    }
    const finish = (): void => {
      setLoadingCompositionId((current) => (current === id ? null : current));
      loadingCompositionTimerRef.current = null;
    };
    if (import.meta.env.MODE === 'test' || typeof window === 'undefined') {
      finish();
      return;
    }
    loadingCompositionTimerRef.current = setTimeout(finish, 90);
  }, []);

  const markCompositionLoading = useCallback((id: string): void => {
    if (loadingCompositionTimerRef.current) {
      clearTimeout(loadingCompositionTimerRef.current);
      loadingCompositionTimerRef.current = null;
    }
    setLoadingCompositionId(id);
  }, []);

  useEffect(
    () => () => {
      if (loadingCompositionTimerRef.current) {
        clearTimeout(loadingCompositionTimerRef.current);
      }
    },
    [],
  );

  const runAfterLoadingPaint = useCallback(
    (action: () => void, loadingId?: string): void => {
      const seq = loadingTransitionSeqRef.current + 1;
      loadingTransitionSeqRef.current = seq;
      const run = (): void => {
        if (loadingTransitionSeqRef.current !== seq) return;
        action();
        if (loadingId) finishCompositionLoadingSoon(loadingId);
      };
      if (import.meta.env.MODE === 'test' || typeof window === 'undefined') {
        run();
        return;
      }
      window.setTimeout(run, 32);
    },
    [finishCompositionLoadingSoon],
  );

  return {
    loadingCompositionId,
    finishCompositionLoadingSoon,
    markCompositionLoading,
    runAfterLoadingPaint,
  };
}
