import { SettingsLayout, SettingsSection, SettingsRow } from "./SettingsLayout";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

export function AboutPage() {
  const profile = useAuthStore((s) => s.profile);
  const theme = useThemeStore((s) => s.theme);
  const navigate = useNavigate();
  const [version, setVersion] = useState("0.2.0");

  useEffect(() => {
    let active = true;
    getVersion()
      .then((v) => active && setVersion(v))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <SettingsLayout>
      <SettingsSection title="About VTalk">
        <div className="space-y-3 text-sm">
          <SettingsRow label="Version" description="Current build">
            <span className="font-mono text-xs">v{version}</span>
          </SettingsRow>
          <SettingsRow label="Theme" description="Active appearance">
            <span className="capitalize">{theme}</span>
          </SettingsRow>
          <SettingsRow label="Account" description="Signed in as">
            <span className="text-xs">@{profile?.username ?? "—"}</span>
          </SettingsRow>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          VTalk is a desktop-first social client built with Tauri, React, and
          Supabase. Messages are end-to-end encrypted and media uploads run
          through a background queue.
        </p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/settings/shortcuts")}>
            View shortcuts
          </Button>
        </div>
      </SettingsSection>
    </SettingsLayout>
  );
}
