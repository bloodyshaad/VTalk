import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useReelStore } from "@/stores/reelStore";
import { useAuthStore } from "@/stores/authStore";
import { useUploadStore } from "@/stores/uploadStore";

export function CreateReel() {
  const navigate = useNavigate();
  const create = useReelStore((s) => s.create);
  const user = useAuthStore((s) => s.user);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file || !user) return;
      setIsSubmitting(true);
      try {
        const url = await useUploadStore.getState().enqueue(file, "media");
      if (!url) throw new Error("Upload failed");
      await create({ video_url: url, caption: caption || null });
      navigate("/reels");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create reel");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold">Create Reel</h1>

      <input
        type="file"
        accept="video/*"
        onChange={onSelectFile}
        className="mb-4 block w-full text-sm"
      />

      {preview && (
        <video src={preview} controls className="mb-4 h-72 w-full rounded-lg bg-black" />
      )}

      <Textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Write a caption…"
        className="mb-4"
      />

      <Button className="w-full" disabled={!file || isSubmitting} onClick={submit}>
        {isSubmitting ? "Posting…" : "Share reel"}
      </Button>
    </div>
  );
}
