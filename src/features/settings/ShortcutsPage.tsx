import { SettingsLayout, SettingsSection } from "./SettingsLayout";
import { SHORTCUTS } from "./shortcutsData";

export function ShortcutsPage() {
  return (
    <SettingsLayout>
      <SettingsSection
        title="Keyboard shortcuts"
        description="Navigate VTalk without leaving the keyboard."
      >
        <ul className="divide-y divide-border">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between py-3">
              <span className="text-sm">{s.description}</span>
              <kbd className="rounded border border-border bg-secondary px-2 py-1 text-xs font-medium">
                {s.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </SettingsLayout>
  );
}
