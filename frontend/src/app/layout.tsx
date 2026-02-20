import type { Metadata } from "next";
import { Crimson_Pro, Source_Sans_3 } from "next/font/google";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { VoiceProvider } from "@/contexts/VoiceContext";
import AuthProvider from "@/components/providers/AuthProvider";
import "./globals.css";

const crimson = Crimson_Pro({
  variable: "--font-crimson",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Doceo — Step-by-step STEM tutoring",
  description:
    "Upload a problem, watch an AI tutor break it into an interactive step-by-step lesson, and ask questions as you learn.",
};

const themeBootScript = `
(() => {
  try {
    const root = document.documentElement;
    root.setAttribute("data-theme-init", "true");
    const stored = localStorage.getItem("doceo-theme");
    const theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    root.setAttribute("data-theme", theme);
    requestAnimationFrame(() => root.removeAttribute("data-theme-init"));
  } catch {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body
        className={`${crimson.variable} ${sourceSans.variable}`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <ThemeProvider>
            <VoiceProvider>{children}</VoiceProvider>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
