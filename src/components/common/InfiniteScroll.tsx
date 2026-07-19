import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export function InfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading,
  children,
  className,
}: {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          onLoadMore();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, isLoading]);

  return (
    <div className={cn("space-y-4", className)}>
      {children}
      <div ref={sentinelRef} className="h-4" />
    </div>
  );
}
