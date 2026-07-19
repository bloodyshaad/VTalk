import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Command, Home, PlusSquare, Settings, SunMoon, Search, Bell, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";

interface CommandItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const setTheme = useThemeStore((s) => s.setTheme);
  const getEffectiveTheme = useThemeStore((s) => s.getEffectiveTheme);

  const commands: CommandItem[] = [
    { label: "Go to Feed", icon: Home, action: () => navigate("/feed") },
    { label: "New Post", icon: PlusSquare, action: () => navigate("/create") },
    { label: "Search", icon: Search, action: () => navigate("/search") },
    { label: "Direct Messages", icon: MessageSquare, action: () => navigate("/direct") },
    { label: "Notifications", icon: Bell, action: () => navigate("/notifications") },
    { label: "Open Settings", icon: Settings, action: () => navigate("/settings") },
    {
      label: "Toggle Theme",
      icon: SunMoon,
      action: () =>
        setTheme(getEffectiveTheme() === "dark" ? "light" : "dark"),
    },
  ];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const items = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()),
  );

  const run = (item: CommandItem) => {
    item.action();
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && items.length > 0) {
      e.preventDefault();
      run(items[0]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="top-[20%] translate-y-0 gap-0 p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center gap-2 text-sm text-muted-foreground">
            <Command className="h-4 w-4" /> Command Palette
          </DialogTitle>
        </DialogHeader>
        <div className="p-2">
          <Input
            autoFocus
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="border-0 focus-visible:ring-0"
          />
          <div className="mt-2 max-h-64 space-y-1 overflow-y-auto">
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => run(item)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-secondary",
                )}
              >
                <item.icon className="h-4 w-4 text-muted-foreground" />
                {item.label}
              </button>
            ))}
            {items.length === 0 && (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No commands found.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
