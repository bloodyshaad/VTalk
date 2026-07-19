import { useRef } from "react";
import { Heart, MessageCircle, Share2, Play, Pause } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/common/Avatar";
import { useReelStore } from "@/stores/reelStore";
import type { Reel } from "@/types/models";

export function ReelActions({ reel }: { reel: Reel }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-4 text-white">
      <button aria-label="Like" className="flex flex-col items-center">
        <Heart className="h-7 w-7" />
        <span className="text-xs">{reel.like_count}</span>
      </button>
      <button
        aria-label="Comments"
        className="flex flex-col items-center"
        onClick={() => navigate(`/post/${reel.id}`)}
      >
        <MessageCircle className="h-7 w-7" />
        <span className="text-xs">{reel.comment_count}</span>
      </button>
      <button aria-label="Share" className="flex flex-col items-center">
        <Share2 className="h-7 w-7" />
      </button>
    </div>
  );
}

export function ReelPlayer({ reel }: { reel: Reel }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isPlaying = useReelStore((s) => s.isPlaying);
  const togglePlay = useReelStore((s) => s.togglePlay);
  const navigate = useNavigate();

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-black">
      <video
        ref={videoRef}
        src={reel.video_url}
        poster={reel.thumbnail_url ?? undefined}
        className="max-h-full max-w-full"
        loop
        playsInline
        autoPlay={isPlaying}
        onClick={togglePlay}
      />

      {!isPlaying && (
        <button
          className="absolute inset-0 flex items-center justify-center"
          onClick={togglePlay}
        >
          <Play className="h-16 w-16 text-white/80" />
        </button>
      )}

      {isPlaying && (
        <button className="absolute right-3 top-3 text-white/70" onClick={togglePlay}>
          <Pause className="h-5 w-5" />
        </button>
      )}

      <div className="absolute bottom-4 left-4 right-16">
        <button
          className="flex items-center gap-2"
          onClick={() => navigate(`/profile/${reel.author?.username ?? ""}`)}
        >
          <UserAvatar
            user={reel.author}
            size={36}
          />
          <span className="text-sm font-semibold text-white">
            {reel.author?.username ?? "unknown"}
          </span>
        </button>
        {reel.caption && (
          <p className="mt-2 line-clamp-2 text-sm text-white/90">{reel.caption}</p>
        )}
      </div>

      <div className="absolute bottom-4 right-3">
        <ReelActions reel={reel} />
      </div>
    </div>
  );
}
