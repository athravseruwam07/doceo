"use client";

import React, { createContext, useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";

  const savedTheme = localStorage.getItem("doceo-theme");
  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(themeValue: Theme) {
  const html = document.documentElement;
  if (themeValue === "dark") {
    html.setAttribute("data-theme", "dark");
  } else {
    html.removeAttribute("data-theme");
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setThemeAndPersist = useCallback((nextTheme: Theme) => {
    setTheme(nextTheme);
    if (typeof window !== "undefined") {
      localStorage.setItem("doceo-theme", nextTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeAndPersist(theme === "light" ? "dark" : "light");
  }, [theme, setThemeAndPersist]);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme: setThemeAndPersist, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
