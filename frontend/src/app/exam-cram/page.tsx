"use client";

import { useMemo, useState } from "react";
import { createExamCramPlanUpload, createExamCramSession } from "@/lib/api";
import { ExamCramResponse } from "@/lib/types";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import AppNavbar from "@/components/nav/AppNavbar";

const SUBJECT_HINTS = [
  "General STEM",
  "Algebra",
  "Calculus",
  "Physics",
  "Chemistry",
  "Statistics",
];

export default function ExamCramPage() {
  const [examName, setExamName] = useState("");
  const [subjectHint, setSubjectHint] = useState("General STEM");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExamCramResponse | null>(null);

  const hasInput = useMemo(
    () => files.length > 0 || notes.trim().length > 0,
    [files.length, notes]
  );

  const handleSubmit = async () => {
    if (!hasInput || loading) return;

    setLoading(true);
    setError(null);

    try {
      const session = await createExamCramSession({
        problem_text: examName.trim()
          ? `Exam Cram Session: ${examName.trim()}`
          : "Exam Cram Session",
        subject_hint: subjectHint.trim() || undefined,
      });

      const payload = await createExamCramPlanUpload(session.session_id, {
        files,
        notes,
        subject_hint: subjectHint,
        exam_name: examName.trim() || undefined,
      });
      setResult(payload);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Failed to generate exam cram plan."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--cream)]">
      <AppNavbar />

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] p-5">
          <h1 className="font-[family-name:var(--font-heading)] text-[30px] leading-tight text-[var(--ink)]">
            Exam Cram Mode
          </h1>
          <p className="mt-2 text-[14px] text-[var(--ink-secondary)]">
            Upload past exams, lecture notes, or textbook excerpts. Doceo will
            prioritize likely topics and generate focused practice.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-[12px] text-[var(--ink-tertiary)]">
                Exam name
              </label>
              <input
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="e.g. Calculus Midterm 2"
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-2 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--emerald)]"
              />
            </div>
            <div>
              <label className="text-[12px] text-[var(--ink-tertiary)]">
                Subject
              </label>
              <select
                value={subjectHint}
                onChange={(e) => setSubjectHint(e.target.value)}
                className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-2 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--emerald)]"
              >
                {SUBJECT_HINTS.map((hint) => (
                  <option key={hint} value={hint}>
                    {hint}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4">
            <label className="text-[12px] text-[var(--ink-tertiary)]">
              Notes or copied materials
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={8}
              placeholder="Paste lecture summaries, question banks, or textbook snippets..."
              className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-2 text-[14px] text-[var(--ink)] outline-none focus:border-[var(--emerald)]"
            />
          </div>

          <div className="mt-4">
            <label className="text-[12px] text-[var(--ink-tertiary)]">
              Upload files (`.txt`, `.md`, etc.)
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              className="mt-1 block w-full text-[13px] text-[var(--ink-secondary)] file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--paper)] file:px-3 file:py-1.5 file:text-[12px] file:text-[var(--ink)]"
            />
            {files.length > 0 && (
              <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {error && (
            <p className="mt-4 text-[13px] text-[var(--error)]">{error}</p>
          )}

          <div className="mt-5">
            <Button
              onClick={handleSubmit}
              disabled={!hasInput || loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Spinner size={16} />
                  <span>Generating cram plan...</span>
                </>
              ) : (
                "Generate exam cram plan"
              )}
            </Button>
          </div>
        </section>

        {result && (
          <section className="space-y-4">
            {result.recurring_patterns.length > 0 && (
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] p-5">
                <h2 className="text-[20px] font-semibold text-[var(--ink)]">
                  Recurring Patterns
                </h2>
                <div className="mt-3 space-y-2">
                  {result.recurring_patterns.map((pattern, idx) => (
                    <p
                      key={`${pattern}-${idx}`}
                      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-2 text-[13px] text-[var(--ink-secondary)]"
                    >
                      {pattern}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] p-5">
              <h2 className="text-[20px] font-semibold text-[var(--ink)]">
                Prioritized Topics
              </h2>
              <div className="mt-3 space-y-3">
                {result.prioritized_topics.map((topic) => (
                  <div
                    key={topic.topic}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper-warm)] p-3"
                  >
                    <p className="text-[14px] font-medium text-[var(--ink)]">
                      {topic.topic}
                    </p>
                    <p className="text-[12px] text-[var(--ink-tertiary)]">
                      Priority score: {(topic.likelihood * 100).toFixed(0)} / 100
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--ink-tertiary)]">
                      Relative ranking from your uploaded materials (not a statistical probability).
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--ink-secondary)]">
                      {topic.why}
                    </p>
                    {topic.evidence.length > 0 && (
                      <p className="mt-2 text-[12px] text-[var(--ink-tertiary)]">
                        Evidence: {topic.evidence.slice(0, 2).join(" · ")}
                      </p>
                    )}
                    {topic.study_actions.length > 0 && (
                      <p className="mt-1 text-[12px] text-[var(--ink-secondary)]">
                        Next actions: {topic.study_actions.slice(0, 2).join(" | ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] p-5">
              <h2 className="text-[20px] font-semibold text-[var(--ink)]">
                Focused Lessons
              </h2>
              <div className="mt-3 space-y-3">
                {result.focused_lessons.map((lesson) => (
                  <div
                    key={lesson.title}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper-warm)] p-3"
                  >
                    <p className="text-[14px] font-medium text-[var(--ink)]">
                      {lesson.title}
                    </p>
                    <p className="text-[12px] text-[var(--ink-tertiary)]">
                      {lesson.estimated_minutes} min
                    </p>
                    <p className="mt-1 text-[13px] text-[var(--ink-secondary)]">
                      {lesson.objective}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] p-5">
              <h2 className="text-[20px] font-semibold text-[var(--ink)]">
                Practice Questions
              </h2>
              <div className="mt-3 space-y-3">
                {result.practice_questions.map((q, idx) => (
                  <div
                    key={`${q.concept}-${idx}`}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper-warm)] p-3"
                  >
                    <p className="text-[13px] text-[var(--ink-tertiary)]">
                      {q.difficulty.toUpperCase()} • {q.concept}
                    </p>
                    <p className="mt-1 text-[14px] text-[var(--ink)]">
                      {q.question}
                    </p>
                    <p className="mt-2 text-[13px] text-[var(--ink-secondary)]">
                      {q.answer_outline}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
