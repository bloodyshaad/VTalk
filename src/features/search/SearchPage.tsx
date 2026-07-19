import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, X, TrendingUp, Hash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/common/Avatar";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { useSearchStore, loadRecentFromStorage } from "@/stores/searchStore";
import { cn } from "@/lib/utils";
import type { SearchFilter } from "@/lib/api/search";

const FILTERS: { value: SearchFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "people", label: "People" },
  { value: "posts", label: "Posts" },
  { value: "tags", label: "Tags" },
];

export function SearchPage() {
  const navigate = useNavigate();
  const {
    query,
    filter,
    results,
    recent,
    trending,
    isLoading,
    error,
    setQuery,
    setFilter,
    runSearch,
    loadTrending,
    addToRecent,
    clearRecent,
  } = useSearchStore();

  useEffect(() => {
    loadRecentFromStorage();
    void loadTrending();
  }, [loadTrending]);

  useEffect(() => {
    const t = setTimeout(() => void runSearch(), 300);
    return () => clearTimeout(t);
  }, [query, filter, runSearch]);

  const submit = () => {
    if (query.trim()) addToRecent(query);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Search people, posts, #tags"
          className="pl-9"
        />
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as SearchFilter)} className="mt-4">
        <TabsList className="w-full">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value} className="flex-1">
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error && <p className="mt-4 text-sm text-destructive-foreground dark:text-foreground">{error}</p>}

      {isLoading && !query ? (
        <LoadingSkeleton lines={4} className="mt-4" />
      ) : !query.trim() ? (
        <div className="mt-6 space-y-6">
          {recent.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recent</h2>
                <button onClick={clearRecent} className="text-xs text-muted-foreground">
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <button
                    key={r}
                    onClick={() => setQuery(r)}
                    className="rounded-full bg-secondary px-3 py-1 text-sm"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="mb-2 flex items-center gap-1 text-sm font-semibold">
              <TrendingUp className="h-4 w-4" /> Trending
            </h2>
            <div className="flex flex-wrap gap-2">
              {trending.map((t) => (
                <button
                  key={t}
                  onClick={() => setQuery(t)}
                  className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                >
                  <Hash className="h-3 w-3" /> {t.replace("#", "")}
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {results.people.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">People</h2>
              <ul className="space-y-1">
                {results.people.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate(`/profile/${p.username}`)}
                      className="flex w-full items-center gap-3 rounded-md p-2 hover:bg-secondary"
                    >
                      <UserAvatar
                        user={{
                          id: p.id,
                          username: p.username,
                          display_name: p.display_name,
                          avatar_url: p.avatar_url,
                        }}
                        size={40}
                      />
                      <div className="text-left">
                        <p className="text-sm font-medium">{p.display_name ?? p.username}</p>
                        <p className="text-xs text-muted-foreground">@{p.username}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.posts.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Posts</h2>
              <ul className="space-y-1">
                {results.posts.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate(`/post/${p.id}`)}
                      className="block w-full truncate rounded-md p-2 text-left text-sm hover:bg-secondary"
                    >
                      {p.content ?? "(media post)"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.tags.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {results.tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setQuery(t)}
                    className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm"
                  >
                    <Hash className="h-3 w-3" /> {t.replace("#", "")}
                  </button>
                ))}
              </div>
            </section>
          )}

          {results.people.length === 0 &&
            results.posts.length === 0 &&
            results.tags.length === 0 && (
              <EmptyState title="No results" description={`Nothing found for "${query}"`} />
            )}
        </div>
      )}
    </div>
  );
}
