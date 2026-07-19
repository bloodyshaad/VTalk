import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OptimizedImage } from "@/components/common/OptimizedImage";
import { useProfileStore } from "@/stores/profileStore";
import { uploadMedia } from "@/lib/upload";
import type { Profile } from "@/types/database";

export function EditProfile({ profile, open, onOpenChange }: { profile: Profile; open: boolean; onOpenChange: (o: boolean) => void }) {
  const update = useProfileStore((s) => s.update);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [coverUrl, setCoverUrl] = useState(profile.cover_url ?? "");
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [saving, setSaving] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const handleUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    kind: "avatar" | "cover",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    try {
      const url = await uploadMedia(file, kind === "avatar" ? "avatars" : "covers", profile.id);
      if (kind === "avatar") setAvatarUrl(url);
      else setCoverUrl(url);
    } catch {
      // ignore
    } finally {
      setUploading(null);
      e.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await update({
        display_name: displayName,
        bio,
        website,
        avatar_url: avatarUrl || null,
        cover_url: coverUrl || null,
      });
      onOpenChange(false);
    } catch {
      // error surfaced in store
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Cover photo</Label>
            <div className="relative h-24 w-full overflow-hidden rounded-sm bg-secondary">
              {coverUrl && (
                <OptimizedImage
                  src={coverUrl}
                  alt="cover"
                  className="h-full w-full object-cover"
                />
              )}
              <button
                type="button"
                onClick={() => coverInput.current?.click()}
                className="absolute inset-0 flex items-center justify-center bg-black/30 text-xs font-medium text-white"
              >
                {uploading === "cover" ? "Uploading…" : "Change cover"}
              </button>
              <input
                ref={coverInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleUpload(e, "cover")}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-secondary">
              {avatarUrl && (
                <OptimizedImage
                  src={avatarUrl}
                  alt="avatar"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => avatarInput.current?.click()}
                disabled={uploading === "avatar"}
              >
                {uploading === "avatar" ? "Uploading…" : "Change photo"}
              </Button>
              <input
                ref={avatarInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleUpload(e, "avatar")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              className="flex min-h-[80px] w-full rounded-sm border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
