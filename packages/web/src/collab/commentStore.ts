import { create } from 'zustand';
import type { Comment } from '@bim-ai/core';

interface CommentState {
  modelId: string | null;
  comments: Comment[];
  load: (modelId: string, comments: Comment[]) => void;
  addComment: (comment: Comment) => void;
  resolveComment: (commentId: string, resolvedAt: number) => void;
  deleteComment: (commentId: string) => void;
}

export const useCommentStore = create<CommentState>((set) => ({
  modelId: null,
  comments: [],

  load: (modelId, comments) => set({ modelId, comments }),

  addComment: (comment) => set((state) => ({ comments: [...state.comments, comment] })),

  resolveComment: (commentId, resolvedAt) =>
    set((state) => ({
      comments: state.comments.map((c) => (c.id === commentId ? { ...c, resolvedAt } : c)),
    })),

  deleteComment: (commentId) =>
    set((state) => ({
      comments: state.comments.filter((c) => c.id !== commentId),
    })),
}));
