import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FollowList } from "./FollowList";
import { getProfileByUsername } from "@/lib/api/profiles";
import { getFollowers, getFollowing } from "@/lib/api/follows";
import type { UserSummary } from "@/types/models";

export function FollowListWrapper({ mode }: { mode: "followers" | "following" }) {
  const { username } = useParams<{ username: string }>();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!username) return;
      setLoading(true);
      try {
        const profile = await getProfileByUsername(username);
        if (!profile) return;
        const raw =
          mode === "followers"
            ? await getFollowers(profile.id)
            : await getFollowing(profile.id);
        const mapped = (raw as unknown[]).map((r: unknown) => {
          const row = r as { profiles: UserSummary };
          return row.profiles;
        });
        if (active) setUsers(mapped);
      } catch {
        if (active) setUsers([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [username, mode]);

  return (
    <FollowList
      title={mode === "followers" ? "Followers" : "Following"}
      users={users}
      isLoading={loading}
    />
  );
}
