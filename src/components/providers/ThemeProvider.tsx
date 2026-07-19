import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useThemeStore } from "@/stores/themeStore";

interface ThemeContextValue {
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  effectiveTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const getEffectiveTheme = useThemeStore((s) => s.getEffectiveTheme);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      getEffectiveTheme() === "dark",
    );
  }, [theme, getEffectiveTheme]);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, effectiveTheme: getEffectiveTheme() }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
