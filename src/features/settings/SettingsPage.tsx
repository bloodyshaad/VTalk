import { Link } from "react-router-dom";
import { SettingsLayout, SettingsSection } from "./SettingsLayout";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";

const LINKS = [
  { to: "/settings/theme", label: "Appearance", desc: "Light, dark, or system theme" },
  { to: "/settings/privacy", label: "Privacy", desc: "Account visibility and interactions" },
  { to: "/settings/notifications", label: "Notifications", desc: "Which events notify you" },
  { to: "/settings/shortcuts", label: "Keyboard shortcuts", desc: "Navigate without the mouse" },
  { to: "/settings/about", label: "About", desc: "Version and app info" },
];

export function SettingsPage() {
  return (
    <SettingsLayout>
      <SettingsSection title="General" description="Manage your VTalk preferences.">
        <div className="space-y-2">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to}>
              <Card className="flex items-center justify-between p-4 transition-colors hover:bg-secondary">
                <div>
                  <p className="text-sm font-medium">{l.label}</p>
                  <p className="text-xs text-muted-foreground">{l.desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Card>
            </Link>
          ))}
        </div>
      </SettingsSection>
    </SettingsLayout>
  );
}
