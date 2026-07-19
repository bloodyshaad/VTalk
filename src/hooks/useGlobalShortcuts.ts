import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable
  );
}

/**
 * Global keyboard navigation shortcuts:
 *   g then h  → feed
 *   g then n  → notifications
 *   g then d  → direct messages
 *   g then s  → search
 *   c         → new post
 *   ?         → shortcuts
 * Sequence mode (g then x) is tracked with a short timeout.
 */
export function useGlobalShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    let pendingG = false;
    let gTimer: number | null = null;

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (pendingG) {
        const map: Record<string, string> = {
          h: "/feed",
          n: "/notifications",
          d: "/direct",
          s: "/search",
        };
        const target = map[e.key.toLowerCase()];
        if (target) {
          e.preventDefault();
          navigate(target);
        }
        pendingG = false;
        if (gTimer) window.clearTimeout(gTimer);
        return;
      }

      if (e.key === "g") {
        pendingG = true;
        if (gTimer) window.clearTimeout(gTimer);
        gTimer = window.setTimeout(() => {
          pendingG = false;
        }, 1000);
        return;
      }

      if (e.key === "c") {
        e.preventDefault();
        navigate("/create");
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        navigate("/settings/shortcuts");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
}
