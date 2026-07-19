import { useEffect } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "./NotificationItem";
import { EmptyState } from "@/components/common/EmptyState";
import { useNotificationStore } from "@/stores/notificationStore";

export function NotificationsPage() {
  const { notifications, isLoading, fetch, markRead, markAllRead } =
    useNotificationStore();

  useEffect(() => {
    void fetch();
  }, [fetch]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Notifications</h1>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={() => void markAllRead()}
        >
          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
        </Button>
      </div>

      {isLoading && notifications.length === 0 ? (
        <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-10 w-10" />}
          title="No notifications yet"
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {notifications.map((n) => (
            <li key={n.id}>
              <NotificationItem
                notification={n}
                onClick={() => void markRead(n.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
