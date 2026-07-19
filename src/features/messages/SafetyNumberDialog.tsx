import { useState } from "react";
import { ShieldCheck, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initChatRatchet, getSafetyNumber } from "@/lib/e2eRatchet";
import { getLocalPrivateKeyB64 } from "@/lib/e2e";
import { getChatPeerPublicKey } from "@/lib/api/messages";
import { toast } from "sonner";

/**
 * Shows the chat's safety number so two users can verify out-of-band (read it
 * to each other over a trusted channel) that no MITM sits between them. Both
 * peers compute the identical number from their shared ratchet root key.
 */
export function SafetyNumberDialog({ chatId }: { chatId: string }) {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function compute() {
    try {
      const myPriv = await getLocalPrivateKeyB64();
      const peerPub = await getChatPeerPublicKey(chatId);
      if (!peerPub) {
        toast.error("Peer public key unavailable");
        return;
      }
      await initChatRatchet(chatId, myPriv, peerPub);
      const sn = await getSafetyNumber(chatId);
      setNumber(sn);
      setOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to compute safety number");
    }
  }

  if (number && open) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-medium">
            <ShieldCheck className="h-4 w-4 text-green-500" /> Safety number
          </p>
          <button
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>
        <p className="mt-2 select-all break-all font-mono text-lg tracking-wider">
          {number}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            navigator.clipboard?.writeText(number);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Compare this with your contact over a trusted channel. Identical numbers
          mean your conversation is end-to-end encrypted with no one in between.
        </p>
      </div>
    );
  }

  return (
    <Button variant="ghost" size="sm" onClick={compute} className="gap-1.5">
      <ShieldCheck className="h-4 w-4" /> Verify safety number
    </Button>
  );
}
