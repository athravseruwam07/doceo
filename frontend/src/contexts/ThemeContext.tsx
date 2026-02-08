"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);

function getStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const savedTheme = localStorage.getItem("doceo-theme") as Theme | null;
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return null;
}

function getPreferredTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(
    () => getStoredTheme() ?? getPreferredTheme()
  );

  const applyTheme = useCallback((themeValue: Theme) => {
    const html = document.documentElement;
    html.setAttribute("data-theme", themeValue);
  }, []);

  // Keep HTML theme attribute synchronized with theme state.
  useEffect(() => {
    applyTheme(theme);
  }, [theme, applyTheme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("doceo-theme", next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
