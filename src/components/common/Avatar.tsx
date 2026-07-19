import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { UserSummary } from "@/types/models";

export function UserAvatar({
  user,
  size = 40,
  showOnline = false,
  className,
}: {
  user: UserSummary | null;
  size?: number;
  showOnline?: boolean;
  className?: string;
}) {
  const initial = (
    user?.display_name ??
    user?.username ??
    "U"
  )
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <Avatar className="h-full w-full">
        <AvatarImage src={user?.avatar_url ?? undefined} alt={user?.username ?? "user"} />
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      {showOnline && (
        <span className="absolute -bottom-0 -right-0 block h-3 w-3 rounded-full border-2 border-background bg-success" />
      )}
    </div>
  );
}
