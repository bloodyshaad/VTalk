import { useEffect, useState } from "react";
import {
  CheckCircle2,
  CloudOff,
  Loader2,
  AlertCircle,
  RotateCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUploadStore } from "@/stores/uploadStore";
import { useSyncStore } from "@/stores/syncStore";
import { getVersion } from "@tauri-apps/api/app";

export function StatusBar() {
  const items = useUploadStore((s) => s.items);
  const syncStatus = useSyncStore((s) => s.status);
  const [version, setVersion] = useState("0.2.0");

  useEffect(() => {
    let active = true;
    getVersion()
      .then((v) => active && setVersion(v))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const syncPending = useSyncStore((s) => s.pending);

  const active = items.filter((i) => i.status === "uploading" || i.status === "pending");
  const failed = items.filter((i) => i.status === "failed");

  const syncLabel: Record<string, string> = {
    stopped: "Offline",
    connecting: "Connecting…",
    syncing: "Syncing…",
    synced: "Synced",
    offline: "Offline",
    error: "Sync error — retrying",
  };

  const icon =
    syncStatus === "synced" ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : syncStatus === "syncing" || syncStatus === "connecting" ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : syncStatus === "error" ? (
      <RotateCw className="h-3.5 w-3.5" />
    ) : (
      <CloudOff className="h-3.5 w-3.5" />
    );

  return (
    <footer className="flex h-7 items-center justify-between border-t border-border bg-background px-4 text-xs text-muted-foreground">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1" title={syncLabel[syncStatus]}>
          {icon}
          {syncLabel[syncStatus]}
          {syncPending > 0 ? ` (${syncPending})` : ""}
        </span>
        <span className="flex items-center gap-1">
          {failed.length > 0 ? (
            <AlertCircle className="h-3.5 w-3.5" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
          {active.length > 0
            ? `Uploading ${active.length}…`
            : failed.length > 0
              ? `${failed.length} failed`
              : "Upload queue empty"}
        </span>
      </div>
      <div className={cn("flex items-center gap-1")}>
        <CloudOff className="h-3.5 w-3.5" /> VTalk v{version}
      </div>
    </footer>
  );
}
