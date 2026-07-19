import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useUpdaterStore } from "@/stores/updaterStore";

/**
 * Runs the updater lifecycle: checks for a new release on launch, lets the
 * store auto-download it in the background, then surfaces a toast prompting the
 * user to restart and apply. Mounted once at the app root.
 */
export function UpdateNotifier() {
  const checkForUpdate = useUpdaterStore((s) => s.checkForUpdate);
  const updateReady = useUpdaterStore((s) => s.updateReady);
  const latestVersion = useUpdaterStore((s) => s.latestVersion);
  const toastId = useRef<string | number | null>(null);

  useEffect(() => {
    void checkForUpdate();
  }, [checkForUpdate]);

  useEffect(() => {
    if (updateReady && latestVersion) {
      toastId.current = toast.success(`Update v${latestVersion} ready`, {
        description: "Restart VTalk to install the latest version.",
        action: {
          label: "Restart",
          onClick: () => void useUpdaterStore.getState().restartAndInstall(),
        },
        duration: Infinity,
      });
    }
  }, [updateReady, latestVersion]);

  return null;
}
