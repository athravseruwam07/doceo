import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { VoiceProvider } from "@/contexts/VoiceContext";
import "./globals.css";

const headingFallback =
  "'Iowan Old Style','Palatino Linotype',Palatino,'URW Palladio L',serif";
const bodyFallback =
  "'Avenir Next','Segoe UI',-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif";

export const metadata: Metadata = {
  title: "Doceo — Step-by-step STEM tutoring",
  description:
    "Upload a problem, watch an AI tutor break it down on a whiteboard, ask questions as you learn.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        style={
          {
            "--font-crimson": headingFallback,
            "--font-source": bodyFallback,
          } as CSSProperties
        }
      >
        <ThemeProvider>
          <VoiceProvider>{children}</VoiceProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
