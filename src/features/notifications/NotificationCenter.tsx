import { useEffect, useRef } from "react";
import { Bell, CheckCheck, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationItem } from "./NotificationItem";
import { NotificationBadge } from "./NotificationBadge";
import { useNotificationStore } from "@/stores/notificationStore";

export function NotificationCenter() {
  const {
    notifications,
    isOpen,
    isLoading,
    fetch,
    markRead,
    markAllRead,
    close,
    toggle,
  } = useNotificationStore();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [isOpen, close]);

  return (
    <div className="relative" ref={ref}>
      <Button variant="ghost" size="icon" onClick={toggle} aria-label="Notifications">
        <Bell className="h-5 w-5" />
        <NotificationBadge />
      </Button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-md border border-border bg-background shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void markAllRead()}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={close}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                No notifications yet
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <NotificationItem notification={n} onClick={() => void markRead(n.id)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
