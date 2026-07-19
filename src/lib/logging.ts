import { attachConsole, error as logError, info as logInfo } from "@tauri-apps/plugin-log";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Wire the webview console and unhandled errors into the Tauri log stream so
 * that a release standalone still prints everything to the terminal it was
 * launched from (and to the on-disk log file).
 */
export async function initLogging(): Promise<void> {
  if (!isTauri) return;
  try {
    await attachConsole();
    await logInfo("[vtalk] logging attached (release-visible)");
  } catch {
    // attachConsole is unavailable in the browser dev server; ignore.
  }

  window.addEventListener("error", (e) => {
    const msg = e.error instanceof Error ? `${e.error.name}: ${e.error.message}\n${e.error.stack ?? ""}` : String(e.message);
    void logError(`[window.onerror] ${msg}`);
  });

  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    const msg = r instanceof Error ? `${r.name}: ${r.message}\n${r.stack ?? ""}` : JSON.stringify(r);
    void logError(`[unhandledrejection] ${msg}`);
  });
}
