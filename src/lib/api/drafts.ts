import { getSupabase } from "./supabase";
import type { PostType } from "@/types/database";

export interface DraftPayload {
  [key: string]: unknown;
  type: PostType;
  content: string;
  mediaUrls: string[];
  mediaType: "image" | "video";
  codeSnippet: string;
  codeLanguage: string;
  location: string;
  pollQuestion: string;
  pollOptions: string[];
}

export interface DraftRecord extends DraftPayload {
  id: string;
  updatedAt: string;
}

interface DraftRow {
  id: string;
  type: PostType;
  content: DraftPayload;
  media_paths: string[] | null;
  updated_at: string;
}

function rowToRecord(row: DraftRow): DraftRecord {
  const c = row.content;
  return {
    id: row.id,
    type: row.type,
    content: c.content ?? "",
    mediaUrls: row.media_paths ?? c.mediaUrls ?? [],
    mediaType: c.mediaType ?? "image",
    codeSnippet: c.codeSnippet ?? "",
    codeLanguage: c.codeLanguage ?? "",
    location: c.location ?? "",
    pollQuestion: c.pollQuestion ?? "",
    pollOptions: c.pollOptions ?? ["", ""],
    updatedAt: row.updated_at,
  };
}

export async function listDrafts(): Promise<DraftRecord[]> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("drafts")
    .select("id, type, content, media_paths, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as DraftRow[]).map(rowToRecord);
}

export async function upsertDraft(
  payload: DraftPayload,
  id?: string,
): Promise<DraftRecord> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const row = {
    user_id: user.id,
    type: payload.type,
    content: payload,
    media_paths: payload.mediaUrls,
    updated_at: new Date().toISOString(),
  };

  const query = id
    ? supabase
        .from("drafts")
        .update(row)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, type, content, media_paths, updated_at")
        .single()
    : supabase
        .from("drafts")
        .insert(row)
        .select("id, type, content, media_paths, updated_at")
        .single();

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return rowToRecord(data as unknown as DraftRow);
}

export async function deleteDraft(id: string): Promise<void> {
  const supabase = getSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("drafts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}
