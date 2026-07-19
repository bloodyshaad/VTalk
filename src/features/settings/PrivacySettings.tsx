import { useEffect, useState } from "react";
import { SettingsLayout, SettingsSection, SettingsRow } from "./SettingsLayout";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/stores/authStore";
import { updateProfile } from "@/lib/api/profiles";
import type { AccountType } from "@/types/database";

export function PrivacySettings() {
  const profile = useAuthStore((s) => s.profile);
  const [accountType, setAccountType] = useState<AccountType>("public");
  const [activityStatus, setActivityStatus] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (profile.account_type) setAccountType(profile.account_type);
    if (profile.show_activity_status != null)
      setActivityStatus(profile.show_activity_status);
    if (profile.read_receipts != null) setReadReceipts(profile.read_receipts);
  }, [profile]);

  const persist = async (patch: {
    account_type?: AccountType;
    show_activity_status?: boolean;
    read_receipts?: boolean;
  }) => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile(profile.id, patch);
      await useAuthStore.getState().refreshSession();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout>
      <SettingsSection
        title="Account privacy"
        description="Control who can see your content and interact with you."
      >
        <SettingsRow
          label="Private account"
          description="Only approved followers can see your posts."
        >
          <Switch
            checked={accountType === "private"}
            onCheckedChange={(v) => {
              const next = v ? "private" : "public";
              setAccountType(next);
              void persist({ account_type: next });
            }}
            aria-label="Private account"
          />
        </SettingsRow>
        {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
        {error && <p className="text-xs text-destructive-foreground dark:text-foreground">{error}</p>}
      </SettingsSection>

      <SettingsSection title="Interactions">
        <SettingsRow
          label="Show activity status"
          description="Let others see when you're active."
        >
          <Switch
            checked={activityStatus}
            onCheckedChange={(v) => {
              setActivityStatus(v);
              void persist({ show_activity_status: v });
            }}
            aria-label="Show activity status"
          />
        </SettingsRow>
        <SettingsRow
          label="Read receipts"
          description="Show when you've read messages."
        >
          <Switch
            checked={readReceipts}
            onCheckedChange={(v) => {
              setReadReceipts(v);
              void persist({ read_receipts: v });
            }}
            aria-label="Read receipts"
          />
        </SettingsRow>
      </SettingsSection>
    </SettingsLayout>
  );
}
