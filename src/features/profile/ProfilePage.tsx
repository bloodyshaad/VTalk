import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Grid3x3, Bookmark, FileText } from "lucide-react";
import { ProfileHeader } from "./ProfileHeader";
import { EditProfile } from "./EditProfile";
import { useProfileStore } from "@/stores/profileStore";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { OptimizedImage } from "@/components/common/OptimizedImage";
import { getSavedPostsDetailed, type FeedPostLite } from "@/lib/api/posts";
import {
  listCollections,
  createCollection,
  type Collection,
} from "@/lib/api/saves";
import { cn } from "@/lib/utils";

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { profile, posts, isLoading, error, isFollowing, fetchByUsername, toggleFollow } =
    useProfileStore();
  const currentUser = useAuthStore((s) => s.profile);
  const startChat = useMessageStore((s) => s.startWith);
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState<"posts" | "saved">("posts");
  const [saved, setSaved] = useState<FeedPostLite[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeCollection, setActiveCollection] = useState<string | null>(null);

  const handleMessage = () => {
    if (!profile) return;
    void startChat(profile);
    navigate("/direct");
  };

  const own = currentUser?.username === username;

  useEffect(() => {
    if (username) void fetchByUsername(username);
  }, [username, fetchByUsername]);

  useEffect(() => {
    if (tab !== "saved" || !own) return;
    let active = true;
    setSavedLoading(true);
    getSavedPostsDetailed(50, activeCollection)
      .then((rows) => {
        if (active) setSaved(rows);
      })
      .catch(() => {
        if (active) setSaved([]);
      })
      .finally(() => {
        if (active) setSavedLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tab, own, username, activeCollection]);

  useEffect(() => {
    if (tab !== "saved" || !own) return;
    let active = true;
    listCollections()
      .then((cols) => {
        if (active) setCollections(cols);
      })
      .catch(() => {
        if (active) setCollections([]);
      });
    return () => {
      active = false;
    };
  }, [tab, own, username]);

  const handleCreateCollection = async () => {
    const name = window.prompt("New collection name")?.trim();
    if (!name) return;
    try {
      const col = await createCollection(name);
      setCollections((prev) => [col, ...prev]);
    } catch {
      /* ignore */
    }
  };

  if (isLoading && !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <LoadingSkeleton lines={6} />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <EmptyState title="Profile not found" description={error} />
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div>
      <ProfileHeader
        profile={profile}
        isOwn={Boolean(own)}
        isFollowing={isFollowing}
        onToggleFollow={() => void toggleFollow()}
        onEdit={() => setEditOpen(true)}
        onShowFollowers={() => navigate(`/profile/${username}/followers`)}
        onShowFollowing={() => navigate(`/profile/${username}/following`)}
        onMessage={!own ? handleMessage : undefined}
      />

      <div className="mx-auto max-w-3xl">
        <div className="flex border-b border-border">
          {(own ? (["posts", "saved"] as const) : (["posts"] as const)).map(
            (t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium uppercase tracking-wide",
                  tab === t
                    ? "border-b-2 border-foreground"
                    : "text-muted-foreground",
                )}
              >
                {t === "saved" ? (
                  <Bookmark className="h-4 w-4" />
                ) : (
                  <Grid3x3 className="h-4 w-4" />
                )}{" "}
                {t}
              </button>
            ),
          )}
        </div>

        {tab === "saved" && own && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
            <button
              onClick={() => setActiveCollection(null)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                activeCollection === null
                  ? "bg-foreground text-background"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              All
            </button>
            {collections.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCollection(c.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  activeCollection === c.id
                    ? "bg-foreground text-background"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {c.name} {c.count > 0 && <span>({c.count})</span>}
              </button>
            ))}
            <button
              onClick={() => void handleCreateCollection()}
              className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              + New
            </button>
          </div>
        )}

        {(() => {
          const items = tab === "saved" ? saved : posts;
          if (tab === "saved" && savedLoading) {
            return (
              <div className="p-4">
                <LoadingSkeleton lines={4} />
              </div>
            );
          }
          if (items.length === 0) {
            return (
              <EmptyState
                icon={<Grid3x3 className="h-10 w-10" />}
                title={tab === "saved" ? "No saved posts" : "No posts yet"}
              />
            );
          }
          return (
            <div className="grid grid-cols-3 gap-1 p-1">
              {items.map((p) => {
                const cover = p.media?.[0]?.url ?? "";
                return (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/post/${p.id}`)}
                    className="relative aspect-square overflow-hidden bg-secondary"
                  >
                    {cover ? (
                      <OptimizedImage
                        src={cover}
                        alt="post"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center p-2 text-center">
                        <FileText className="mb-1 h-5 w-5 text-muted-foreground" />
                        <span className="line-clamp-3 text-[10px] text-muted-foreground">
                          {p.content ?? p.type}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })()}
      </div>

      {own && profile && (
        <EditProfile profile={profile} open={editOpen} onOpenChange={setEditOpen} />
      )}
    </div>
  );
}
