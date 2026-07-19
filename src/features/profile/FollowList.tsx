import { UserAvatar } from "@/components/common/Avatar";
import { EmptyState } from "@/components/common/EmptyState";
import type { UserSummary } from "@/types/models";

export function FollowList({
  title,
  users,
  isLoading,
}: {
  title: string;
  users: UserSummary[];
  isLoading?: boolean;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold">{title}</h1>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : users.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()}`} />
      ) : (
        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 py-3">
              <UserAvatar user={u} size={44} />
              <div className="flex-1">
                <p className="text-sm font-semibold">{u.display_name ?? u.username}</p>
                <p className="text-xs text-muted-foreground">@{u.username}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
