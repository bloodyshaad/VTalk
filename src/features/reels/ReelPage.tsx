import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { ChevronUp, ChevronDown } from "lucide-react";
import { ReelPlayer } from "./ReelPlayer";
import { useReelStore } from "@/stores/reelStore";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";

export function ReelPage() {
  const { id } = useParams<{ id: string }>();
  const { reels, currentIndex, isLoading, fetch, load, next, previous } =
    useReelStore();

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    if (id) void load(id);
  }, [id, load, reels.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") next();
      if (e.key === "ArrowUp") previous();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous]);

  const scroll = (dir: "up" | "down") => (dir === "down" ? next() : previous());

  if (isLoading && reels.length === 0) {
    return <LoadingSkeleton lines={3} className="mx-auto max-w-md" />;
  }

  const reel = reels[currentIndex];
  if (!reel) {
    return <p className="p-6 text-center text-sm text-muted-foreground">No reels yet</p>;
  }

  return (
    <div className="relative mx-auto h-full max-h-[calc(100vh-3.5rem-1.75rem)] w-full max-w-md">
      <ReelPlayer reel={reel} />

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 flex-col gap-3">
        <button aria-label="Previous" className="text-white/80" onClick={() => scroll("up")}>
          <ChevronUp className="h-7 w-7" />
        </button>
        <button aria-label="Next" className="text-white/80" onClick={() => scroll("down")}>
          <ChevronDown className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
