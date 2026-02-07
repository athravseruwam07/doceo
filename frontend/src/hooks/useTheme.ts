"use client";

import { useContext } from "react";
import { ThemeContext } from "@/contexts/ThemeContext";

export function useTheme() {
  const context = useContext(ThemeContext);

  // Return default context during hydration/SSR
  if (context === undefined) {
    return {
      theme: "light" as const,
      toggleTheme: () => {},
    };
  }

  return context;
}
