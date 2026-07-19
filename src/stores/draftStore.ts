import { create } from "zustand";
import type { PostType } from "@/types/database";
import {
  listDrafts,
  upsertDraft,
  deleteDraft,
  type DraftRecord,
} from "@/lib/api/drafts";

export interface Draft {
  id: string;
  type: PostType;
  content: string;
  mediaUrls: string[];
  mediaType: "image" | "video";
  codeSnippet: string;
  codeLanguage: string;
  location: string;
  pollQuestion: string;
  pollOptions: string[];
  updatedAt: string;
}

function toDraft(r: DraftRecord): Draft {
  return { ...r };
}

interface DraftState {
  drafts: Draft[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (draft: Omit<Draft, "id" | "updatedAt"> & { id?: string }) => Promise<string>;
  remove: (id: string) => Promise<void>;
  get: (id: string) => Draft | undefined;
}

export const useDraftStore = create<DraftState>((set, get) => ({
  drafts: [],
  isLoading: false,
  error: null,

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      const records = await listDrafts();
      set({ drafts: records.map(toDraft) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load drafts" });
    } finally {
      set({ isLoading: false });
    }
  },

  save: async (partial) => {
    const payload = {
      type: partial.type,
      content: partial.content,
      mediaUrls: partial.mediaUrls,
      mediaType: partial.mediaType,
      codeSnippet: partial.codeSnippet,
      codeLanguage: partial.codeLanguage,
      location: partial.location,
      pollQuestion: partial.pollQuestion,
      pollOptions: partial.pollOptions,
    };
    try {
      const saved = await upsertDraft(payload, partial.id);
      const draft = toDraft(saved);
      set((s) => ({
        drafts: [draft, ...s.drafts.filter((d) => d.id !== draft.id)],
      }));
      return draft.id;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to save draft" });
      throw err;
    }
  },

  remove: async (id) => {
    const prev = get().drafts;
    set({ drafts: prev.filter((d) => d.id !== id) });
    try {
      await deleteDraft(id);
    } catch (err) {
      set({ drafts: prev, error: err instanceof Error ? err.message : "Failed to delete" });
    }
  },

  get: (id) => get().drafts.find((d) => d.id === id),
}));
