import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Image as ImageIcon, Video, Type, ListChecks, ArrowLeft, ArrowRight, Check, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createPost, type CreatePostInput } from "@/lib/api/posts";
import { useUploadStore } from "@/stores/uploadStore";
import { useDraftStore, type Draft } from "@/stores/draftStore";
import type { PostType, MediaType } from "@/types/database";

const STEPS = ["Type", "Media", "Details", "Publish"] as const;

function emptyDraft(): Omit<Draft, "id" | "updatedAt"> {
  return {
    type: "image",
    content: "",
    mediaUrls: [],
    mediaType: "image",
    codeSnippet: "",
    codeLanguage: "",
    location: "",
    pollQuestion: "",
    pollOptions: ["", ""],
  };
}

export function CreateWizard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const draftId = searchParams.get("draft");
  const enqueue = useUploadStore((s) => s.enqueue);
  const saveDraft = useDraftStore((s) => s.save);
  const loadDrafts = useDraftStore((s) => s.load);
  const getDraft = useDraftStore((s) => s.get);

  const [step, setStep] = useState(0);
  const [type, setType] = useState<PostType>("image");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState<MediaType>("image");
  const [content, setContent] = useState("");
  const [codeSnippet, setCodeSnippet] = useState("");
  const [codeLanguage, setCodeLanguage] = useState("");
  const [location, setLocation] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!draftId) return;
    let cancelled = false;
    const apply = (d: Draft | undefined) => {
      if (!d || cancelled) return;
      setType(d.type);
      setContent(d.content);
      setMediaUrls(d.mediaUrls);
      setMediaType(d.mediaType);
      setCodeSnippet(d.codeSnippet);
      setCodeLanguage(d.codeLanguage);
      setLocation(d.location);
      setPollQuestion(d.pollQuestion);
      setPollOptions(d.pollOptions.length ? d.pollOptions : ["", ""]);
    };
    const existing = getDraft(draftId);
    if (existing) {
      apply(existing);
    } else {
      void loadDrafts().then(() => apply(getDraft(draftId)));
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId]);

  const canNext =
    step === 0
      ? true
      : step === 1
        ? type === "text" || type === "poll" || mediaUrls.length > 0
        : true;

  const validatePoll = (): string | null => {
    const q = pollQuestion.trim();
    const opts = pollOptions.filter((o) => o.trim().length > 0);
    if (!q) return "Poll question is required.";
    if (opts.length < 2) return "Add at least two poll options.";
    return null;
  };

  const buildInput = (): CreatePostInput => {
    const input: CreatePostInput = { type };
    if (type === "text") {
      input.content = content;
    } else if (type === "poll") {
      input.content = content;
      input.poll = {
        question: pollQuestion,
        options: pollOptions.filter((o) => o.trim().length > 0),
      };
    } else {
      input.content = content || null;
      input.media = mediaUrls
        .filter((u) => u.trim().length > 0)
        .map((u) => ({ url: u.trim(), media_type: mediaType }));
      if (type === "album") input.content = content || null;
    }
    if (codeSnippet) {
      input.code_snippet = codeSnippet;
      input.code_language = codeLanguage || "plaintext";
    }
    if (location) input.location = location;
    return input;
  };

  const persistDraft = async () => {
    try {
      await saveDraft({
        id: draftId ?? undefined,
        type,
        content,
        mediaUrls,
        mediaType,
        codeSnippet,
        codeLanguage,
        location,
        pollQuestion,
        pollOptions,
      });
      navigate("/drafts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft");
    }
  };

  const onPickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const urls: string[] = [];
      for (const f of files) {
        const url = await enqueue(f, "media");
        if (url) urls.push(url);
      }
      if (urls.length) {
        setMediaUrls((prev) => [...prev, ...urls]);
        setMediaType(files[0].type.startsWith("video") ? "video" : "image");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const publish = async () => {
    if (type === "poll") {
      const pollErr = validatePoll();
      if (pollErr) {
        setError(pollErr);
        return;
      }
    }
    if (
      (type === "image" || type === "video" || type === "album") &&
      mediaUrls.filter((u) => u.trim().length > 0).length === 0
    ) {
      setError("Add at least one photo or video before publishing.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const id = await createPost(buildInput());
      if (draftId) await useDraftStore.getState().remove(draftId);
      navigate(`/post/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Create post</h1>
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1.5 w-8 rounded-full",
                i <= step ? "bg-foreground" : "bg-secondary",
              )}
            />
          ))}
        </div>
      </div>

      <Card className="p-6">
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { t: "image", icon: ImageIcon, label: "Image" },
                { t: "video", icon: Video, label: "Video" },
                { t: "text", icon: Type, label: "Text" },
                { t: "album", icon: ImageIcon, label: "Album" },
                { t: "poll", icon: ListChecks, label: "Poll" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.t}
                onClick={() => setType(opt.t as PostType)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border p-6 text-sm",
                  type === opt.t ? "border-foreground" : "border-border",
                )}
              >
                <opt.icon className="h-6 w-6" />
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            {type !== "text" && type !== "poll" && (
              <>
                <div className="flex gap-2">
                  <Button
                    variant={mediaType === "image" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMediaType("image")}
                  >
                    Image
                  </Button>
                  <Button
                    variant={mediaType === "video" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMediaType("video")}
                  >
                    Video
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label>Upload media</Label>
                  <input
                    type="file"
                    accept={mediaType === "image" ? "image/*" : "video/*"}
                    multiple
                    onChange={onPickFiles}
                    disabled={isUploading}
                    className="block w-full text-sm"
                  />
                  {isUploading && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading via queue…
                    </p>
                  )}
                  {mediaUrls.length > 0 && (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {mediaUrls.map((u, i) => (
                        <li key={i} className="truncate">
                          ✓ {u.split("/").pop()}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Files are uploaded through the background upload queue (Rust in
                    desktop, Supabase in browser) and stored in the media bucket.
                  </p>
                </div>
              </>
            )}
            {type === "text" && (
              <p className="text-sm text-muted-foreground">
                Text posts need no media. Continue to add your message.
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            {type !== "poll" && (
              <div className="space-y-2">
                <Label>Caption</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write a caption…"
                  rows={4}
                />
              </div>
            )}
            {type === "poll" && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Poll question</Label>
                  <Input
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="Ask a question…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Options</Label>
                  {pollOptions.map((opt, i) => (
                    <Input
                      key={i}
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[i] = e.target.value;
                        setPollOptions(next);
                      }}
                      placeholder={`Option ${i + 1}`}
                    />
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                  >
                    Add option
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm">Review and publish your {type} post.</p>
            {codeSnippet !== undefined && (
              <div className="space-y-2">
                <Label>Code snippet (optional)</Label>
                <Textarea
                  value={codeSnippet}
                  onChange={(e) => setCodeSnippet(e.target.value)}
                  placeholder="// paste code"
                  rows={3}
                  className="font-mono text-xs"
                />
                <Input
                  value={codeLanguage}
                  onChange={(e) => setCodeLanguage(e.target.value)}
                  placeholder="language (e.g. ts, rust)"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Location (optional)</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Add location"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive-foreground dark:text-foreground">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => (step === 0 ? navigate(-1) : setStep((s) => s - 1))}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void persistDraft()} disabled={isSubmitting}>
              <Save className="h-4 w-4" /> Save draft
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => void publish()} disabled={isSubmitting || isUploading}>
                <Check className="h-4 w-4" /> {isSubmitting ? "Publishing…" : "Publish"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
