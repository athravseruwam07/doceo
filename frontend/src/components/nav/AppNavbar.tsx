"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "@/hooks/useTheme";

export default function AppNavbar() {
  const { data: session } = useSession();
  const { toggleTheme } = useTheme();

  const initial = session?.user?.name?.charAt(0).toUpperCase() || session?.user?.email?.charAt(0).toUpperCase() || "?";

  return (
    <nav className="px-6 py-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--paper)]">
      <Link href="/app" className="font-[family-name:var(--font-heading)] text-[20px] font-semibold tracking-tight text-[var(--ink)]">
        Doceo
      </Link>

      <div className="flex items-center gap-4">
        <Link
          href="/app"
          className="px-3 py-1.5 rounded-md border border-[var(--border)] text-[12px] text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--cream-dark)] transition-colors font-[family-name:var(--font-body)]"
        >
          Home
        </Link>
        <Link
          href="/exam-cram"
          className="px-3 py-1.5 rounded-md border border-[var(--border)] text-[12px] text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--cream-dark)] transition-colors font-[family-name:var(--font-body)]"
        >
          Exam Cram
        </Link>
        <Link
          href="/history"
          className="px-3 py-1.5 rounded-md border border-[var(--border)] text-[12px] text-[var(--ink-secondary)] hover:text-[var(--ink)] hover:bg-[var(--cream-dark)] transition-colors font-[family-name:var(--font-body)]"
        >
          History
        </Link>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-md hover:bg-[var(--cream-dark)] transition-colors cursor-pointer"
          aria-label="Toggle theme"
        >
          <svg className="w-5 h-5 text-[var(--ink)]" fill="none" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M10 2v2M10 16v2M2 10h2M16 10h2M4.34 4.34l1.41 1.41M14.24 14.24l1.41 1.41M15.66 4.34l-1.41 1.41M5.76 14.24l-1.41 1.41"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {session?.user && (
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-full bg-[var(--emerald-subtle)] text-[var(--emerald)] flex items-center justify-center text-[12px] font-semibold font-[family-name:var(--font-body)]"
              title={session.user.name || session.user.email || ""}
            >
              {initial}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-[12px] text-[var(--ink-tertiary)] hover:text-[var(--ink)] transition-colors cursor-pointer font-[family-name:var(--font-body)]"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
