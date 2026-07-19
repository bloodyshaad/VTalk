import { SettingsLayout, SettingsSection } from "./SettingsLayout";
import { useThemeStore, type Theme } from "@/stores/themeStore";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";

const OPTIONS: { value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeSettings() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <SettingsLayout>
      <SettingsSection
        title="Appearance"
        description="Choose how VTalk looks. Your preference is saved on this device."
      >
        <div className="grid grid-cols-3 gap-3">
          {OPTIONS.map((o) => (
            <button
              key={o.value}
              onClick={() => setTheme(o.value)}
              aria-pressed={theme === o.value}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg border p-4 text-sm",
                theme === o.value
                  ? "border-foreground bg-secondary"
                  : "border-border hover:bg-secondary",
              )}
            >
              <o.icon className="h-5 w-5" />
              {o.label}
            </button>
          ))}
        </div>
      </SettingsSection>
    </SettingsLayout>
  );
}
