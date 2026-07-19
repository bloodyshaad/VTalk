import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/common/Avatar";
import { OptimizedImage } from "@/components/common/OptimizedImage";
import { AccountTypeBadge } from "./AccountTypeBadge";
import type { Profile } from "@/types/database";

export function ProfileHeader({
  profile,
  isOwn,
  isFollowing,
  onToggleFollow,
  onEdit,
  onShowFollowers,
  onShowFollowing,
  onMessage,
}: {
  profile: Profile;
  isOwn: boolean;
  isFollowing: boolean;
  onToggleFollow: () => void;
  onEdit: () => void;
  onShowFollowers: () => void;
  onShowFollowing: () => void;
  onMessage?: () => void;
  onShowPosts?: () => void;
}) {
  return (
    <div className="border-b border-border">
      <div className="h-32 bg-secondary md:h-48">
        {profile.cover_url && (
          <OptimizedImage
            src={profile.cover_url}
            alt="cover"
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="mx-auto max-w-3xl px-4">
        <div className="-mt-12 flex items-end justify-between">
          <UserAvatar
            user={{
              id: profile.id,
              username: profile.username,
              display_name: profile.display_name,
              avatar_url: profile.avatar_url,
            }}
            size={96}
            className="rounded-full border-4 border-background"
          />
          <div className="mb-2 flex gap-2">
            {isOwn ? (
              <Button variant="outline" onClick={onEdit}>
                Edit profile
              </Button>
            ) : (
              <>
                <Button
                  variant={isFollowing ? "outline" : "default"}
                  onClick={onToggleFollow}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Button>
                {onMessage && (
                  <Button variant="outline" onClick={onMessage}>
                    Message
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">
              {profile.display_name ?? profile.username}
            </h1>
            <AccountTypeBadge
              userType={profile.user_type}
              isVerified={profile.is_verified}
            />
          </div>
          <p className="text-sm text-muted-foreground">@{profile.username}</p>
          {profile.bio && <p className="mt-2 text-sm">{profile.bio}</p>}
          {profile.website && (
            <a
              href={profile.website}
              className="text-sm text-muted-foreground underline"
              target="_blank"
              rel="noreferrer"
            >
              {profile.website}
            </a>
          )}

          <div className="mt-3 flex gap-6 pb-4 text-sm">
            <button className="hover:underline">
              <span className="font-semibold">{profile.post_count}</span> posts
            </button>
            <button onClick={onShowFollowers} className="hover:underline">
              <span className="font-semibold">{profile.follower_count}</span>{" "}
              followers
            </button>
            <button onClick={onShowFollowing} className="hover:underline">
              <span className="font-semibold">{profile.following_count}</span>{" "}
              following
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
