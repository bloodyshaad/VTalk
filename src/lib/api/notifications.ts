import { getSupabase } from "./supabase";
import type { AppNotification, UserSummary } from "@/types/models";
import type { NotificationRow } from "@/types/database";

const NOTIF_SELECT = `
  id, type, post_id, is_read, created_at,
  actor:actor_id ( id, username, display_name, avatar_url )
`;

type NotifRow = NotificationRow & {
  actor: Pick<UserSummary, "id" | "username" | "display_name" | "avatar_url"> | null;
};

function mapNotif(row: NotifRow): AppNotification {
  return {
    id: row.id,
    type: row.type,
    post_id: row.post_id,
    is_read: row.is_read,
    created_at: row.created_at,
    actor: row.actor
      ? {
          id: row.actor.id,
          username: row.actor.username,
          display_name: row.actor.display_name,
          avatar_url: row.actor.avatar_url,
        }
      : null,
  };
}

export async function getNotifications(limit = 50): Promise<AppNotification[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("notifications")
    .select(NOTIF_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as NotifRow[]).map(mapNotif);
}

export async function getUnreadCount(): Promise<number> {
  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("is_read", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markRead(id: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllRead(): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) throw new Error(error.message);
}
