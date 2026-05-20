import { useCallback } from 'react';

import { fetchComments, patchCommentResolved, postComment } from '../lib/api';
import { mapComments } from './workspaceUtils';

export function useWorkspaceComments({
  modelId,
  userDisplayName,
  activeLevelId,
  selectedId,
  setComments,
}: {
  modelId: string | null | undefined;
  userDisplayName: string | null | undefined;
  activeLevelId: string | null | undefined;
  selectedId: string | null | undefined;
  setComments: (comments: ReturnType<typeof mapComments>) => void;
}) {
  const handleCommentPost = useCallback(
    async (body: string): Promise<void> => {
      if (!modelId) return;
      await postComment(modelId, {
        userDisplay: userDisplayName || 'Guest',
        body,
        levelId: activeLevelId ?? undefined,
        elementId: selectedId ?? undefined,
      });
      const c = await fetchComments(modelId);
      setComments(mapComments((c.comments ?? []) as Record<string, unknown>[]));
    },
    [modelId, userDisplayName, activeLevelId, selectedId, setComments],
  );

  const handleCommentResolve = useCallback(
    async (commentId: string, resolved: boolean): Promise<void> => {
      if (!modelId) return;
      await patchCommentResolved(modelId, commentId, resolved);
      const c = await fetchComments(modelId);
      setComments(mapComments((c.comments ?? []) as Record<string, unknown>[]));
    },
    [modelId, setComments],
  );

  return { handleCommentPost, handleCommentResolve };
}
