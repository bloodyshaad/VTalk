import { useNotificationStore } from "@/stores/notificationStore";
import { cn } from "@/lib/utils";

export function NotificationBadge({ className }: { className?: string }) {
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  if (unreadCount <= 0) return null;
  return (
    <span
      className={cn(
        "ml-2 inline-flex min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-destructive-foreground",
        className,
      )}
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}
