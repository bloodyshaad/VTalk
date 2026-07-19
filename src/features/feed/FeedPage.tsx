import { useEffect } from "react";
import { useFeedStore } from "@/stores/feedStore";
import { FeedCard } from "./FeedCard";
import { InfiniteScroll } from "@/components/common/InfiniteScroll";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Newspaper } from "lucide-react";
import { StoryTray } from "@/features/stories/StoryTray";

export function FeedPage() {
  const {
    posts,
    activeTab,
    isLoading,
    hasMore,
    fetchFeed,
    fetchNextPage,
    setActiveTab,
  } = useFeedStore();

  useEffect(() => {
    void fetchFeed();
  }, [fetchFeed]);

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6">
      <StoryTray />

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "following" | "forYou")}
        className="mb-4"
      >
        <TabsList className="w-full">
          <TabsTrigger value="forYou" className="flex-1">
            For You
          </TabsTrigger>
          <TabsTrigger value="following" className="flex-1">
            Following
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading && posts.length === 0 ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="mx-auto h-48 w-full max-w-[680px] rounded-xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-10 w-10" />}
          title="No posts yet"
          description="When people you follow post, it'll show up here."
        />
      ) : (
        <InfiniteScroll
          onLoadMore={fetchNextPage}
          hasMore={hasMore}
          isLoading={isLoading}
        >
          {posts.map((post) => (
            <FeedCard key={post.id} post={post} />
          ))}
          {isLoading && (
            <Skeleton className="mx-auto h-48 w-full max-w-[680px] rounded-xl" />
          )}
        </InfiniteScroll>
      )}
    </div>
  );
}
