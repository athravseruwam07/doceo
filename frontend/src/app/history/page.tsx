"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSessionHistory } from "@/lib/api";
import { SessionHistoryItem } from "@/lib/types";

function formatWhen(value?: string): string {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString();
}

export default function HistoryPage() {
  const [items, setItems] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await getSessionHistory();
        if (!active) return;
        setItems(result);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "Could not load session history.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <nav className="px-6 py-4 flex items-center justify-between border-b border-[var(--border)] bg-[var(--paper)]">
        <span className="font-[family-name:var(--font-heading)] text-[20px] font-semibold text-[var(--ink)]">
          Doceo
        </span>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[13px] text-[var(--ink-tertiary)] hover:text-[var(--ink)]">
            Home
          </Link>
          <Link href="/exam-cram" className="text-[13px] text-[var(--ink-tertiary)] hover:text-[var(--ink)]">
            Exam Cram
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="font-[family-name:var(--font-heading)] text-[30px] text-[var(--ink)] mb-2">
          Question History
        </h1>
        <p className="text-[14px] text-[var(--ink-secondary)] mb-6">
          Reopen prior lessons and continue where you left off.
        </p>

        {loading && <p className="text-[14px] text-[var(--ink-tertiary)]">Loading history…</p>}
        {error && <p className="text-[14px] text-[var(--error)]">{error}</p>}

        {!loading && !error && items.length === 0 && (
          <p className="text-[14px] text-[var(--ink-tertiary)]">No prior sessions yet.</p>
        )}

        <div className="space-y-3">
          {items.map((item) => (
            <Link
              key={item.session_id}
              href={`/lesson/${item.session_id}`}
              className="block rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] p-4 hover:bg-[var(--paper-warm)] transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-medium text-[var(--ink)]">
                  {item.title}
                </p>
                <span className="text-[12px] text-[var(--ink-tertiary)]">
                  {item.status}
                </span>
              </div>
              {item.problem_text && (
                <p className="mt-1 text-[13px] text-[var(--ink-secondary)] line-clamp-2">
                  {item.problem_text}
                </p>
              )}
              <p className="mt-2 text-[12px] text-[var(--ink-tertiary)]">
                {item.subject} · {item.step_count} steps · Updated {formatWhen(item.updated_at || item.created_at)}
              </p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
