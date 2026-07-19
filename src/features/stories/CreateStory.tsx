import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useStoryStore } from "@/stores/storyStore";
import { useAuthStore } from "@/stores/authStore";
import { useUploadStore } from "@/stores/uploadStore";
import type { MediaType } from "@/types/database";

const SWATCHES = ["#f43f5e", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#000000"];

export function CreateStory() {
  const navigate = useNavigate();
  const create = useStoryStore((s) => s.create);
  const user = useAuthStore((s) => s.user);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [text, setText] = useState("");
  const [bg, setBg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setMediaType(f.type.startsWith("video") ? "video" : "image");
    setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!file || !user) return;
    setIsSubmitting(true);
    try {
      const url = await useUploadStore.getState().enqueue(file, "media");
      if (!url) throw new Error("Upload failed");
      await create({
        media_url: url,
        media_type: mediaType,
        text_overlay: text || null,
        background_color: bg,
      });
      navigate("/");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create story");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <h1 className="mb-4 text-lg font-semibold">Create Story</h1>

      <input type="file" accept="image/*,video/*" onChange={onSelectFile} className="mb-4 block w-full text-sm" />

      {preview && (
        <div
          className="relative mb-4 flex h-80 items-center justify-center overflow-hidden rounded-lg"
          style={{ backgroundColor: bg ?? "transparent" }}
        >
          {mediaType === "image" ? (
            <img src={preview} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <video src={preview} controls className="max-h-full max-w-full" />
          )}
          {text && (
            <p className="absolute bottom-6 px-4 text-center text-lg font-medium text-white drop-shadow">
              {text}
            </p>
          )}
        </div>
      )}

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add a caption…"
        className="mb-4"
      />

      <div className="mb-4 flex gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            onClick={() => setBg(c)}
            className="h-8 w-8 rounded-full border-2"
            style={{ backgroundColor: c, borderColor: bg === c ? "#fff" : "transparent" }}
          />
        ))}
      </div>

      <Button className="w-full" disabled={!file || isSubmitting} onClick={submit}>
        {isSubmitting ? "Posting…" : "Share to story"}
      </Button>
    </div>
  );
}
