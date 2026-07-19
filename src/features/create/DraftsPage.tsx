import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Trash2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { Card } from "@/components/ui/card";
import { useDraftStore } from "@/stores/draftStore";
import { timeAgo } from "@/lib/utils";

export function DraftsPage() {
  const navigate = useNavigate();
  const { drafts, load, remove } = useDraftStore();

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Drafts</h1>
        <Button size="sm" onClick={() => navigate("/create")}>
          <Plus className="h-4 w-4" /> New post
        </Button>
      </div>

      {drafts.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-10 w-10" />}
          title="No drafts"
          description="Posts you save as drafts will appear here, synced to your account."
        />
      ) : (
        <ul className="space-y-3">
          {drafts.map((d) => (
            <Card key={d.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium uppercase">
                    {d.type}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(d.updatedAt)}
                  </span>
                  {d.mediaUrls.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {d.mediaUrls.length} media
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm">
                  {d.content || d.pollQuestion || "(no text)"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Edit"
                onClick={() => navigate(`/create?draft=${d.id}`)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete"
                onClick={() => void remove(d.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          ))}
        </ul>
      )}
    </div>
  );
}
