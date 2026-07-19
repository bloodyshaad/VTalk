import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  getEffectiveTheme: () => "light" | "dark";
}

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const effective = theme === "system" ? getSystemTheme() : theme;
  root.classList.toggle("dark", effective === "dark");
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "system",
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
      getEffectiveTheme: () => {
        const { theme } = get();
        return theme === "system" ? getSystemTheme() : theme;
      },
    }),
    {
      name: "vtalk-theme",
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    },
  ),
);

export function initTheme() {
  const { theme } = useThemeStore.getState();
  applyTheme(theme);
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener
  ) {
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        const { theme, getEffectiveTheme } = useThemeStore.getState();
        if (theme === "system") {
          document.documentElement.classList.toggle(
            "dark",
            getEffectiveTheme() === "dark",
          );
        }
      });
  }
}
