import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/common/Avatar";
import { useStoryStore } from "@/stores/storyStore";
import { useAuthStore } from "@/stores/authStore";
import { useNavigate } from "react-router-dom";

const PROGRESS_MS = 5000;

export function StoryViewer() {
  const navigate = useNavigate();
  const {
    groups,
    activeGroupIndex,
    activeStoryIndex,
    isViewing,
    closeViewer,
    next,
    previous,
    remove,
  } = useStoryStore();
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isViewing) return;
    setProgress(0);
    timerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          next();
          return 0;
        }
        return p + 100 / (PROGRESS_MS / 100);
      });
    }, 100);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [isViewing, activeGroupIndex, activeStoryIndex, next]);

  if (!isViewing) return null;
  const group = groups[activeGroupIndex];
  if (!group) return null;
  const story = group.stories[activeStoryIndex];
  if (!story) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={closeViewer}
    >
      <button
        className="absolute left-4 top-4 z-10 text-white"
        onClick={(e) => {
          e.stopPropagation();
          closeViewer();
        }}
      >
        <X className="h-6 w-6" />
      </button>

      {currentUserId === group.author.id && (
        <button
          className="absolute right-4 top-4 z-10 text-white"
          aria-label="Delete story"
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm("Delete this story?")) void remove(story.id);
          }}
        >
          <Trash2 className="h-6 w-6" />
        </button>
      )}

      <button
        className="absolute left-2 top-1/2 -translate-y-1/2 text-white"
        onClick={(e) => {
          e.stopPropagation();
          previous();
        }}
      >
        <ChevronLeft className="h-8 w-8" />
      </button>

      <button
        className="absolute right-2 top-1/2 -translate-y-1/2 text-white"
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
      >
        <ChevronRight className="h-8 w-8" />
      </button>

      <div className="relative h-[80vh] w-[420px] max-w-[90vw] overflow-hidden rounded-lg bg-black" onClick={(e) => e.stopPropagation()}>
        <div className="absolute left-0 right-0 top-0 z-10 flex gap-1 p-2">
          {group.stories.map((_, i) => (
            <div key={i} className="h-1 flex-1 rounded-full bg-white/30">
              <div
                className="h-full rounded-full bg-white"
                style={{ width: i < activeStoryIndex ? "100%" : i === activeStoryIndex ? `${progress}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        <div className="absolute left-3 top-4 z-10 flex items-center gap-2">
          <UserAvatar
            user={{
              id: group.author.id,
              username: group.author.username,
              display_name: group.author.display_name,
              avatar_url: group.author.avatar_url,
            }}
            size={32}
          />
          <span className="text-sm font-medium text-white">{group.author.username}</span>
        </div>

        {story.media_type === "image" ? (
          <img src={story.media_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <video src={story.media_url} autoPlay loop className="h-full w-full object-cover" />
        )}

        {story.text_overlay && (
          <div className="absolute inset-x-0 bottom-12 flex justify-center px-6">
            <p
              className="rounded bg-black/40 px-3 py-1 text-center text-white"
              style={{ backgroundColor: story.background_color ?? "rgba(0,0,0,0.4)" }}
            >
              {story.text_overlay}
            </p>
          </div>
        )}

        <button
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/20 px-4 py-1 text-sm text-white"
          onClick={() => navigate(`/profile/${group.author.username}`)}
        >
          View profile
        </button>
      </div>
    </div>
  );
}
