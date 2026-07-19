import { create } from "zustand";
import { search, getTrendingTags, type SearchFilter, type SearchResults } from "@/lib/api/search";

interface SearchState {
  query: string;
  filter: SearchFilter;
  results: SearchResults;
  recent: string[];
  trending: string[];
  isLoading: boolean;
  error: string | null;
  setQuery: (q: string) => void;
  setFilter: (f: SearchFilter) => void;
  runSearch: () => Promise<void>;
  loadTrending: () => Promise<void>;
  addToRecent: (q: string) => void;
  clearRecent: () => void;
}

const RECENT_KEY = "vtalk-recent-searches";

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  filter: "all",
  results: { people: [], posts: [], tags: [] },
  recent: [],
  trending: [],
  isLoading: false,
  error: null,

  setQuery: (q) => set({ query: q }),
  setFilter: (filter) => set({ filter }),

  runSearch: async () => {
    const { query, filter } = get();
    if (!query.trim()) {
      set({ results: { people: [], posts: [], tags: [] } });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const results = await search(query, filter);
      set({ results });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Search failed" });
    } finally {
      set({ isLoading: false });
    }
  },

  loadTrending: async () => {
    try {
      const trending = await getTrendingTags();
      set({ trending });
    } catch {
      // ignore
    }
  },

  addToRecent: (q) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    const recent = [trimmed, ...get().recent.filter((r) => r !== trimmed)].slice(0, 10);
    set({ recent });
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
    } catch {
      // ignore
    }
  },

  clearRecent: () => {
    set({ recent: [] });
    try {
      localStorage.removeItem(RECENT_KEY);
    } catch {
      // ignore
    }
  },
}));

export function loadRecentFromStorage() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) useSearchStore.setState({ recent: JSON.parse(raw) });
  } catch {
    // ignore
  }
}
