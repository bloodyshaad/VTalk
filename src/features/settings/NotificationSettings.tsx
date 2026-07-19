import { useEffect, useState } from "react";
import { SettingsLayout, SettingsSection, SettingsRow } from "./SettingsLayout";
import { Switch } from "@/components/ui/switch";
import {
  loadNotifPrefs,
  saveNotifPrefs,
  syncNotifPrefsToServer,
  DEFAULT_NOTIF_PREFS,
  type NotifPrefs,
} from "@/lib/notifPrefs";
import { useNotificationStore } from "@/stores/notificationStore";
import { useAuthStore } from "@/stores/authStore";

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotifPrefs>(loadNotifPrefs);
  const refetch = useNotificationStore((s) => s.fetch);
  const serverPrefs = useAuthStore((s) => s.profile?.notification_prefs);

  useEffect(() => {
    if (serverPrefs && Object.keys(serverPrefs).length > 0) {
      const merged = { ...DEFAULT_NOTIF_PREFS, ...serverPrefs } as NotifPrefs;
      setPrefs(merged);
      saveNotifPrefs(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPrefs]);

  useEffect(() => {
    saveNotifPrefs(prefs);
    void syncNotifPrefsToServer(prefs);
    void refetch();
  }, [prefs, refetch]);

  const toggle = async (key: keyof NotifPrefs) => {
    const next = !prefs[key];
    if (key === "desktop" && next && typeof Notification !== "undefined") {
      try {
        if (Notification.permission === "default") {
          await Notification.requestPermission();
        }
      } catch {
        // ignore
      }
    }
    setPrefs((p) => ({ ...p, [key]: next }));
  };

  return (
    <SettingsLayout>
      <SettingsSection
        title="Push & in-app"
        description="Choose which events notify you. Synced to your account."
      >
        <SettingsRow label="Likes" description="Someone likes your post.">
          <Switch checked={prefs.likes} onCheckedChange={() => void toggle("likes")} aria-label="Likes" />
        </SettingsRow>
        <SettingsRow label="Comments" description="Someone comments on your post.">
          <Switch checked={prefs.comments} onCheckedChange={() => void toggle("comments")} aria-label="Comments" />
        </SettingsRow>
        <SettingsRow label="New followers" description="Someone follows you.">
          <Switch checked={prefs.follows} onCheckedChange={() => void toggle("follows")} aria-label="New followers" />
        </SettingsRow>
        <SettingsRow label="Mentions" description="You are mentioned in a post or comment.">
          <Switch checked={prefs.mentions} onCheckedChange={() => void toggle("mentions")} aria-label="Mentions" />
        </SettingsRow>
        <SettingsRow label="Direct messages" description="You receive a new message.">
          <Switch checked={prefs.messages} onCheckedChange={() => void toggle("messages")} aria-label="Direct messages" />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Desktop notifications">
        <SettingsRow label="Enable desktop notifications" description="Show a toast when VTalk is in the background.">
          <Switch checked={prefs.desktop} onCheckedChange={() => void toggle("desktop")} aria-label="Desktop notifications" />
        </SettingsRow>
      </SettingsSection>
    </SettingsLayout>
  );
}
