import { getSupabase } from "@/lib/api/supabase";

export interface NotifPrefs {
  [key: string]: boolean;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  mentions: boolean;
  messages: boolean;
  desktop: boolean;
}

export const NOTIF_PREFS_KEY = "vtalk-notif-prefs";

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  likes: true,
  comments: true,
  follows: true,
  mentions: true,
  messages: true,
  desktop: true,
};

export function loadNotifPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY);
    if (raw) return { ...DEFAULT_NOTIF_PREFS, ...(JSON.parse(raw) as NotifPrefs) };
  } catch {
    // ignore
  }
  return DEFAULT_NOTIF_PREFS;
}

export function saveNotifPrefs(prefs: NotifPrefs): void {
  try {
    localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

/** Persist prefs to the user's profile so they sync across devices. */
export async function syncNotifPrefsToServer(prefs: NotifPrefs): Promise<void> {
  try {
    const supabase = getSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ notification_prefs: prefs })
      .eq("id", user.id);
  } catch {
    // ignore; local prefs remain the source of truth
  }
}

/** Returns true if a notification of the given type should be shown. */
export function isNotifTypeEnabled(type: string, prefs = loadNotifPrefs()): boolean {
  switch (type) {
    case "like":
      return prefs.likes;
    case "comment":
    case "reply":
      return prefs.comments;
    case "follow":
    case "follow_request":
    case "accepted":
      return prefs.follows;
    case "mention":
      return prefs.mentions;
    case "message":
      return prefs.messages;
    default:
      return true;
  }
}
