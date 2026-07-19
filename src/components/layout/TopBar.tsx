import { useLocation, useNavigate } from "react-router-dom";
import { Bell, PanelLeft, Plus, Sun, Moon, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { NotificationCenter } from "@/features/notifications/NotificationCenter";
import { cn } from "@/lib/utils";

const breadcrumbMap: Record<string, string> = {
  "/feed": "Feed",
  "/search": "Search",
  "/create": "Create",
  "/direct": "Direct Messages",
  "/notifications": "Notifications",
  "/drafts": "Drafts",
  "/settings": "Settings",
};

export function TopBar({
  onToggleSidebar,
  collapsed,
}: {
  onToggleSidebar: () => void;
  collapsed: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);

  const title =
    breadcrumbMap[location.pathname] ??
    (location.pathname.startsWith("/profile")
      ? "Profile"
      : location.pathname.startsWith("/post")
        ? "Post"
        : location.pathname.startsWith("/reels")
          ? "Reels"
          : "VTalk");

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeft className={cn("h-5 w-5", collapsed && "rotate-180")} />
        </Button>
        <h1 className="text-sm font-semibold">{title}</h1>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/create")}
          aria-label="Create"
        >
          <Plus className="h-5 w-5" />
        </Button>
        <NotificationCenter />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(nextTheme)}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? (
            <Sun className="h-5 w-5" />
          ) : (
            <Moon className="h-5 w-5" />
          )}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 rounded-full focus:outline-none">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback>
                  {profile
                    ? (profile.display_name ?? profile.username).slice(0, 2).toUpperCase()
                    : "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              {profile ? `@${profile.username}` : "Account"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate(`/profile/${profile?.username ?? ""}`)}>
              <UserIcon className="h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings")}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void logout().then(() => navigate("/auth/login"))}
            >
              <LogOut className="h-4 w-4" /> Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
