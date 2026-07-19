import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { Poll } from "@/types/models";
import { Button } from "@/components/ui/button";
import { votePoll, unvotePoll } from "@/lib/api/posts";
import { cn } from "@/lib/utils";

export function PollViewer({
  poll,
  onVoted,
}: {
  poll: Poll;
  onVoted?: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(poll.voted_option_ids);
  const [submitted, setSubmitted] = useState(poll.voted_option_ids.length > 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
  const expired = poll.expires_at
    ? new Date(poll.expires_at).getTime() < Date.now()
    : false;

  const toggle = (id: string) => {
    if (submitted || expired) return;
    setSelected((prev) =>
      poll.is_multiple_choice
        ? prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id]
        : [id],
    );
  };

  const submit = async () => {
    if (selected.length === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await votePoll(poll.id, selected);
      setSubmitted(true);
      onVoted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setSubmitting(false);
    }
  };

  const changeVote = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await unvotePoll(poll.id);
      setSubmitted(false);
      setSelected([]);
      onVoted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change vote");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <p className="text-sm font-semibold">{poll.question}</p>
      {poll.options.map((opt) => {
        const pct = totalVotes ? Math.round((opt.votes / totalVotes) * 100) : 0;
        const isSel = selected.includes(opt.id);
        return (
          <button
            key={opt.id}
            onClick={() => toggle(opt.id)}
            className={cn(
              "relative w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm",
              isSel ? "border-foreground" : "border-border",
            )}
          >
            {submitted && (
              <span
                className="absolute inset-y-0 left-0 bg-secondary"
                style={{ width: `${pct}%` }}
              />
            )}
            <span className="relative flex items-center justify-between">
              <span>{opt.text}</span>
              {submitted ? (
                <span className="text-muted-foreground">{pct}%</span>
              ) : isSel ? (
                <Check className="h-4 w-4" />
              ) : null}
            </span>
          </button>
        );
      })}
      {!submitted && !expired && (
        <Button
          size="sm"
          className="w-full"
          onClick={() => void submit()}
          disabled={selected.length === 0 || submitting}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Vote"}
        </Button>
      )}
      {submitted && !expired && (
        <Button
          size="sm"
          variant="ghost"
          className="w-full"
          onClick={() => void changeVote()}
          disabled={submitting}
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change vote"}
        </Button>
      )}
      {error && <p className="text-xs text-destructive-foreground">{error}</p>}
      <p className="text-xs text-muted-foreground">
        {totalVotes} vote{totalVotes === 1 ? "" : "s"}
        {poll.expires_at && ` · Closes ${new Date(poll.expires_at).toLocaleDateString()}`}
      </p>
    </div>
  );
}
