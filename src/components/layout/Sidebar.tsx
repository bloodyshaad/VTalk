import { Home, Search, PlusSquare, Send, Heart, User, FileText, BarChart3, Settings } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import { useMessageStore } from "@/stores/messageStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NavItem {
  to: string;
  label: string;
  icon: typeof Home;
  badge?: "messages" | "notifications";
}

const navItems: NavItem[] = [
  { to: "/feed", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/create", label: "Create", icon: PlusSquare },
  { to: "/direct", label: "Direct", icon: Send, badge: "messages" },
  { to: "/notifications", label: "Notifications", icon: Heart, badge: "notifications" },
  { to: "/drafts", label: "Drafts", icon: FileText },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const profile = useAuthStore((s) => s.profile);
  const unreadMessages = useMessageStore((s) => s.unreadTotal);
  const unreadNotifications = useNotificationStore((s) => s.unreadCount);
  const username = profile?.username ?? "profile";
  const profileItem: NavItem = { to: `/profile/${username}`, label: "Profile", icon: User };

  const items = [...navItems.slice(0, 5), profileItem, ...navItems.slice(5)];

  const badgeFor = (kind?: "messages" | "notifications") => {
    if (kind === "messages") return unreadMessages;
    if (kind === "notifications") return unreadNotifications;
    return 0;
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-background transition-all duration-200",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 items-center border-b border-border px-4">
        {collapsed ? (
          <span className="text-lg font-bold">V</span>
        ) : (
          <span className="text-xl font-bold tracking-tight">VTalk</span>
        )}
      </div>

      <nav className="flex-1 space-y-1 p-2">
        {items.map((item) => {
          const badge = badgeFor(item.badge);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-0",
                  isActive
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )
              }
              title={item.label}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && badge > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-foreground px-1.5 text-xs font-semibold text-background">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {profile && (
        <div className="border-t border-border p-2">
          <NavLink
            to={`/profile/${username}`}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 hover:bg-secondary",
              collapsed && "justify-center px-0",
            )}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback>
                {(profile.display_name ?? profile.username).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <span className="text-sm font-medium">@{profile.username}</span>
            )}
          </NavLink>
        </div>
      )}
    </aside>
  );
}
