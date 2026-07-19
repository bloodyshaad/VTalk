import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { UserAvatar } from "@/components/common/Avatar";
import { StoryRing } from "./StoryRing";
import { useStoryStore } from "@/stores/storyStore";
import { useAuthStore } from "@/stores/authStore";
import type { StoryGroup } from "@/types/models";

export function StoryTray() {
  const navigate = useNavigate();
  const groups = useStoryStore((s) => s.groups);
  const fetch = useStoryStore((s) => s.fetch);
  const openViewer = useStoryStore((s) => s.openViewer);
  const profile = useAuthStore((s) => s.profile);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return (
    <div className="flex gap-4 overflow-x-auto px-4 py-3">
      <button
        onClick={() => navigate("/create/story")}
        className="flex flex-col items-center gap-1"
      >
        <div className="relative">
          <UserAvatar
            user={{
              id: profile?.id ?? "",
              username: profile?.username ?? "",
              display_name: profile?.display_name ?? "",
              avatar_url: profile?.avatar_url ?? null,
            }}
            size={56}
          />
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-foreground text-background">
            <Plus className="h-3 w-3" />
          </span>
        </div>
        <span className="text-xs">Your story</span>
      </button>

      {groups.map((g: StoryGroup, i) => (
        <button
          key={g.author.id}
          onClick={() => openViewer(i)}
          className="flex flex-col items-center gap-1"
        >
          <StoryRing seen={g.viewed}>
            <UserAvatar
              user={{
                id: g.author.id,
                username: g.author.username,
                display_name: g.author.display_name,
                avatar_url: g.author.avatar_url,
              }}
              size={56}
            />
          </StoryRing>
          <span className="max-w-[64px] truncate text-xs">
            {g.author.display_name ?? g.author.username}
          </span>
        </button>
      ))}
    </div>
  );
}
