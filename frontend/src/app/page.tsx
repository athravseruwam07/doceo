"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { useUpload } from "@/hooks/useUpload";
import { useTheme } from "@/hooks/useTheme";
import {
  createCourse,
  deleteCourse,
  listCourseLessons,
  listCourseMaterials,
  listCourses,
  uploadCourseMaterial,
} from "@/lib/api";
import { CourseLesson, CourseMaterial, CourseSummary } from "@/lib/types";
import UploadZone from "@/components/upload/UploadZone";
import TextInputArea from "@/components/upload/TextInputArea";
import UploadPreview from "@/components/upload/UploadPreview";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

type InputMode = "upload" | "type";
type LessonFormat = "full" | "micro";

const SUBJECT_HINTS = [
  "General STEM",
  "Algebra",
  "Calculus",
  "Physics",
  "Chemistry",
  "Statistics",
];

const EXAMPLE_PROBLEMS = [
  {
    subject: "Calculus",
    text: "Find the derivative of f(x) = 3x^4 - 2x^2 + 7x - 5",
  },
  {
    subject: "Algebra",
    text: "Solve the system: 2x + y = 11 and x - y = 1",
  },
  {
    subject: "Physics",
    text: "A 2kg object accelerates at 3m/s^2. What force is applied?",
  },
];

const RECENT_PROBLEMS_KEY = "doceo-recent-problems";
const RECENT_PROBLEMS_EVENT = "doceo-recent-problems-change";

const EMPTY_RECENT_PROBLEMS: string[] = [];
let recentProblemsRawCache: string | null = null;
let recentProblemsSnapshotCache: string[] = EMPTY_RECENT_PROBLEMS;

function getRecentProblemsSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY_RECENT_PROBLEMS;

  const raw = localStorage.getItem(RECENT_PROBLEMS_KEY);
  if (raw === recentProblemsRawCache) {
    return recentProblemsSnapshotCache;
  }

  recentProblemsRawCache = raw;
  if (!raw) {
    recentProblemsSnapshotCache = EMPTY_RECENT_PROBLEMS;
    return recentProblemsSnapshotCache;
  }

  try {
    const parsed = JSON.parse(raw) as string[];
    recentProblemsSnapshotCache = Array.isArray(parsed)
      ? parsed.slice(0, 5)
      : EMPTY_RECENT_PROBLEMS;
  } catch {
    recentProblemsSnapshotCache = EMPTY_RECENT_PROBLEMS;
  }

  return recentProblemsSnapshotCache;
}

function getRecentProblemsServerSnapshot(): string[] {
  return EMPTY_RECENT_PROBLEMS;
}

function subscribeRecentProblems(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handleStorage = (event: StorageEvent) => {
    if (event.key === RECENT_PROBLEMS_KEY) listener();
  };
  const handleChange = () => listener();

  window.addEventListener("storage", handleStorage);
  window.addEventListener(RECENT_PROBLEMS_EVENT, handleChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(RECENT_PROBLEMS_EVENT, handleChange);
  };
}

export default function Home() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const {
    file,
    setFile,
    text,
    setText,
    subjectHint,
    setSubjectHint,
    courseId,
    setCourseId,
    loading,
    error,
    submit,
  } = useUpload();
  const [mode, setMode] = useState<InputMode>("type");
  const recentProblems = useSyncExternalStore(
    subscribeRecentProblems,
    getRecentProblemsSnapshot,
    getRecentProblemsServerSnapshot
  );
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [newCourseLabel, setNewCourseLabel] = useState("");
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [notesUploading, setNotesUploading] = useState(false);
  const [courseError, setCourseError] = useState<string | null>(null);
  const [lessonFormat, setLessonFormat] = useState<LessonFormat>("full");
  const [microVoiceEnabled, setMicroVoiceEnabled] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setCoursesLoading(true);
    listCourses()
      .then((items) => {
        if (cancelled) return;
        setCourses(items);
        setCourseError(null);
        setCourseId((current) =>
          !current && items.length > 0 ? items[0].course_id : current
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setCourseError(err instanceof Error ? err.message : "Failed to load courses");
      })
      .finally(() => {
        if (!cancelled) setCoursesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setCourseId]);

  useEffect(() => {
    if (!courseId) {
      setMaterials([]);
      setLessons([]);
      return;
    }
    let cancelled = false;
    setMaterialsLoading(true);
    setLessonsLoading(true);
    Promise.all([listCourseMaterials(courseId), listCourseLessons(courseId)])
      .then(([materialsItems, lessonItems]) => {
        if (!cancelled) {
          setMaterials(materialsItems);
          setLessons(lessonItems);
          setCourseError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setCourseError(
            err instanceof Error ? err.message : "Failed to load course materials"
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMaterialsLoading(false);
          setLessonsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const refreshCourses = async (preferredCourseId?: string) => {
    const items = await listCourses();
    setCourses(items);
    const hasPreferred =
      !!preferredCourseId &&
      items.some((course) => course.course_id === preferredCourseId);
    const hasCurrent = !!courseId && items.some((course) => course.course_id === courseId);
    const nextCourseId = hasPreferred
      ? (preferredCourseId as string)
      : hasCurrent
        ? courseId
        : (items[0]?.course_id ?? "");
    setCourseId(nextCourseId);
    return nextCourseId;
  };

  const refreshMaterials = async (selectedCourseId: string) => {
    if (!selectedCourseId) return;
    const items = await listCourseMaterials(selectedCourseId);
    setMaterials(items);
  };

  const refreshLessons = async (selectedCourseId: string) => {
    if (!selectedCourseId) return;
    const items = await listCourseLessons(selectedCourseId);
    setLessons(items);
  };

  const handleCreateCourse = async () => {
    const label = newCourseLabel.trim();
    if (!label) return;

    setCourseError(null);
    try {
      const created = await createCourse(label);
      setNewCourseLabel("");
      const nextCourseId = await refreshCourses(created.course_id);
      if (nextCourseId) {
        await Promise.all([refreshMaterials(nextCourseId), refreshLessons(nextCourseId)]);
      } else {
        setMaterials([]);
        setLessons([]);
      }
    } catch (err) {
      setCourseError(err instanceof Error ? err.message : "Failed to create course");
    }
  };

  const handleUploadNotes = async () => {
    if (!courseId || !notesFile) return;

    setCourseError(null);
    setNotesUploading(true);
    try {
      await uploadCourseMaterial(courseId, notesFile);
      setNotesFile(null);
      const nextCourseId = await refreshCourses(courseId);
      if (nextCourseId) {
        await Promise.all([refreshMaterials(nextCourseId), refreshLessons(nextCourseId)]);
      }
    } catch (err) {
      setCourseError(err instanceof Error ? err.message : "Failed to upload notes");
    } finally {
      setNotesUploading(false);
    }
  };

  const handleDeleteCourse = async (course: CourseSummary) => {
    if (typeof window !== "undefined") {
      const shouldDelete = window.confirm(
        `Delete "${course.label}" and all notes in it? This cannot be undone.`
      );
      if (!shouldDelete) return;
    }

    setCourseError(null);
    try {
      await deleteCourse(course.course_id);
      setNotesFile(null);
      const nextCourseId = await refreshCourses();
      if (nextCourseId) {
        await Promise.all([refreshMaterials(nextCourseId), refreshLessons(nextCourseId)]);
      } else {
        setMaterials([]);
        setLessons([]);
      }
    } catch (err) {
      setCourseError(err instanceof Error ? err.message : "Failed to delete course");
    }
  };

  const formatLessonDate = (rawDate: string) => {
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime())) return "Saved lesson";
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const saveRecentProblem = (problem: string) => {
    const cleaned = problem.trim();
    if (!cleaned || typeof window === "undefined") return;

    const next = [cleaned, ...recentProblems.filter((p) => p !== cleaned)].slice(
      0,
      5
    );
    const serialized = JSON.stringify(next);
    recentProblemsRawCache = serialized;
    recentProblemsSnapshotCache = next;
    localStorage.setItem(RECENT_PROBLEMS_KEY, serialized);
    window.dispatchEvent(new Event(RECENT_PROBLEMS_EVENT));
  };

  const handleSubmit = async () => {
    const isMicroLesson = lessonFormat === "micro";
    const sessionId = await submit({
      microLesson: isMicroLesson,
      includeVoice: isMicroLesson ? microVoiceEnabled : true,
    });
    if (!sessionId) return;
    if (text.trim()) {
      saveRecentProblem(text.trim());
    }
    router.push(`/lesson/${sessionId}`);
  };

  const hasInput = !!file || text.trim().length > 0;
  const selectedCourse = courses.find((course) => course.course_id === courseId) || null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-[var(--border)]">
        <span className="font-[family-name:var(--font-heading)] text-[20px] font-semibold tracking-tight text-[var(--ink)]">
          Doceo
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:bg-[var(--cream-dark)] transition-colors cursor-pointer"
            aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            title={theme === "light" ? "Dark mode" : "Light mode"}
          >
            {theme === "light" ? (
              <svg
                className="w-5 h-5 text-[var(--ink)]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-[var(--ink)]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1h0zm4.323 2.677a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707h0zm2.828 2.828a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zm2.828 2.829a1 1 0 00-1.415-1.414l-.707.707a1 1 0 001.414 1.414l.708-.707zM10 8a2 2 0 100 4 2 2 0 000-4zm.464 7.535a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zm2.828 2.829a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zm2.828 2.828a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-2.464 2.536a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM5.464 7.464a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zm2.828-2.829a1 1 0 00-1.414-1.414L5.343 4.464a1 1 0 001.414 1.414l.707-.707zm0 11.314a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM2 11a1 1 0 100-2H1a1 1 0 100 2h1z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
          <span className="text-[12px] text-[var(--ink-tertiary)] tracking-wide uppercase font-[family-name:var(--font-body)]">
            AI Tutor
          </span>
        </div>
      </nav>

      {/* Hero + Input */}
      <main className="flex-1 px-4 py-12">
        <motion.div
          className="mx-auto w-full max-w-6xl grid gap-6 lg:grid-cols-[280px_1fr]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <aside className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] p-4 h-fit lg:sticky lg:top-6">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[14px] font-semibold text-[var(--ink)] font-[family-name:var(--font-heading)]">
                Course Labels
              </p>
              {coursesLoading && (
                <span className="text-[11px] text-[var(--ink-tertiary)]">Loading...</span>
              )}
            </div>
            <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">
              Select a course from this panel and start a lesson with its notes context.
            </p>

            <div className="mt-3 max-h-[300px] overflow-y-auto space-y-2 pr-1">
              {courses.length === 0 && (
                <p className="text-[12px] text-[var(--ink-faint)]">
                  No course labels yet. Create one below.
                </p>
              )}
              {courses.map((course) => {
                const isSelected = course.course_id === courseId;
                return (
                  <div
                    key={course.course_id}
                    className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper-warm)] p-1.5"
                  >
                    <button
                      onClick={() => setCourseId(course.course_id)}
                      className={`flex-1 text-left rounded-[var(--radius-sm)] px-2 py-1.5 text-[12px] transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[var(--emerald)] text-white"
                          : "text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
                      }`}
                      title={`${course.label} (${course.material_count} files)`}
                    >
                      <span className="block truncate">{course.label}</span>
                      <span className={`block text-[10px] ${isSelected ? "text-white/80" : "text-[var(--ink-faint)]"}`}>
                        {course.material_count} files
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeleteCourse(course)}
                      className="px-2 py-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] text-[var(--ink-faint)] hover:text-[var(--error)] hover:border-[var(--error)] transition-colors cursor-pointer"
                      title={`Delete ${course.label}`}
                      aria-label={`Delete ${course.label}`}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <input
                value={newCourseLabel}
                onChange={(e) => setNewCourseLabel(e.target.value)}
                placeholder="New course label"
                className="flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-2 text-[13px]"
              />
              <button
                onClick={handleCreateCourse}
                className="px-3 py-2 rounded-[var(--radius-md)] bg-[var(--emerald)] text-white text-[12px] hover:bg-[var(--emerald-light)] transition-colors cursor-pointer"
              >
                Add
              </button>
            </div>
          </aside>

          <div>
          {/* Heading */}
          <div className="mb-10 text-center lg:text-left">
            <h1 className="font-[family-name:var(--font-heading)] text-[clamp(32px,5vw,48px)] font-bold leading-[1.1] text-[var(--ink)] mb-3">
              Learn step by step
            </h1>
            <p className="text-[var(--ink-secondary)] text-[16px] leading-relaxed max-w-md mx-auto font-[family-name:var(--font-body)] font-light">
              Paste a screenshot or type a STEM problem. Doceo breaks it down on
              a whiteboard and walks you through every step.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUBJECT_HINTS.map((hint) => (
                <button
                  key={hint}
                  onClick={() => setSubjectHint(hint)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer ${
                    subjectHint === hint
                      ? "bg-[var(--emerald)] text-white"
                      : "bg-[var(--paper)] border border-[var(--border)] text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
                  }`}
                >
                  {hint}
                </button>
              ))}
            </div>
          </div>

          {/* Course notes library */}
          <div className="mb-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-[14px] font-semibold text-[var(--ink)] font-[family-name:var(--font-heading)]">
                  Course Notes Library
                </p>
                <p className="text-[12px] text-[var(--ink-tertiary)] font-[family-name:var(--font-body)]">
                  Upload notes by class (Math, Science, etc.) and personalize tutoring.
                  Large PDFs are supported (up to 120 MB) and may take longer to process.
                </p>
              </div>
              {selectedCourse ? (
                <span className="text-[11px] rounded-full bg-[var(--emerald-subtle)] text-[var(--emerald)] px-2 py-1">
                  Selected: {selectedCourse.label}
                </span>
              ) : (
                <span className="text-[11px] text-[var(--ink-faint)]">
                  Select a course label on the left
                </span>
              )}
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_auto]">
              <input
                type="file"
                accept=".txt,.md,.pdf,.docx"
                onChange={(e) => setNotesFile(e.target.files?.[0] ?? null)}
                disabled={notesUploading}
                className="text-[12px] text-[var(--ink-tertiary)] file:mr-3 file:px-3 file:py-1.5 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--paper-warm)]"
              />
              <button
                onClick={handleUploadNotes}
                disabled={!courseId || !notesFile || notesUploading}
                className="px-3 py-2 rounded-[var(--radius-md)] border border-[var(--emerald)] text-[var(--emerald)] text-[12px] hover:bg-[var(--emerald-subtle)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {notesUploading ? "Uploading..." : "Upload Notes"}
              </button>
            </div>

            {!courseId && (
              <p className="mt-2 text-[11px] text-[var(--ink-faint)]">
                Choose a course label in the left panel, then upload notes here.
              </p>
            )}

            {materialsLoading && (
              <p className="mt-3 text-[12px] text-[var(--ink-tertiary)]">Loading materials...</p>
            )}

            {materials.length > 0 && (
              <div className="mt-3 max-h-[130px] overflow-y-auto space-y-1.5">
                {materials.map((material) => (
                  <div
                    key={material.material_id}
                    className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--paper-warm)] px-2.5 py-1.5"
                  >
                    <p className="text-[12px] text-[var(--ink-secondary)] font-medium">
                      {material.filename}
                    </p>
                    <p className="text-[11px] text-[var(--ink-faint)]">
                      {material.chunk_count} chunks · {material.char_count} chars
                    </p>
                  </div>
                ))}
              </div>
            )}

            {lessonsLoading && (
              <p className="mt-3 text-[12px] text-[var(--ink-tertiary)]">
                Loading saved lessons...
              </p>
            )}

            {lessons.length > 0 && (
              <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper-warm)] p-3">
                <p className="text-[12px] font-semibold text-[var(--ink)] mb-2">
                  Previous lessons for this course
                </p>
                <div className="max-h-[180px] overflow-y-auto space-y-1.5">
                  {lessons.map((lesson) => (
                    <button
                      key={lesson.session_id}
                      onClick={() => router.push(`/lesson/${lesson.session_id}`)}
                      className="w-full text-left rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--paper)] px-2.5 py-2 hover:bg-[var(--cream-dark)] transition-colors cursor-pointer"
                      title={lesson.problem_preview || lesson.title}
                    >
                      <p className="text-[12px] text-[var(--ink)] font-medium truncate">
                        {lesson.title}
                      </p>
                      <p className="text-[11px] text-[var(--ink-faint)]">
                        {lesson.lesson_type === "micro" ? "Micro lesson" : "Full lesson"} •{" "}
                        {lesson.subject} • {lesson.step_count} steps •{" "}
                        {formatLessonDate(lesson.created_at)}
                      </p>
                      {lesson.problem_preview && (
                        <p className="text-[11px] text-[var(--ink-tertiary)] truncate">
                          {lesson.problem_preview}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {courseId && !lessonsLoading && lessons.length === 0 && (
              <p className="mt-3 text-[11px] text-[var(--ink-faint)]">
                No saved lessons for this course yet. Start a lesson and it will appear here.
              </p>
            )}

            {courseError && (
              <p className="mt-3 text-[12px] text-[var(--error)]">{courseError}</p>
            )}
          </div>

          <div className="mb-5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper)] px-3 py-3">
            <p className="text-[12px] font-semibold text-[var(--ink)] uppercase tracking-wide mb-2">
              Lesson Format
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "full", label: "Full Lesson", hint: "Complete breakdown" },
                  {
                    id: "micro",
                    label: "Micro Lesson",
                    hint: "Quick revision in 1-3 steps",
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  onClick={() => setLessonFormat(option.id)}
                  className={`rounded-[var(--radius-sm)] border px-3 py-1.5 text-[12px] transition-colors cursor-pointer ${
                    lessonFormat === option.id
                      ? "border-[var(--emerald)] bg-[var(--emerald-subtle)] text-[var(--emerald)]"
                      : "border-[var(--border)] bg-[var(--paper-warm)] text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
                  }`}
                  title={option.hint}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {lessonFormat === "micro" && (
              <label className="mt-3 inline-flex items-center gap-2 text-[12px] text-[var(--ink-secondary)]">
                <input
                  type="checkbox"
                  checked={microVoiceEnabled}
                  onChange={(e) => setMicroVoiceEnabled(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--emerald)]"
                />
                Include voice narration
              </label>
            )}
          </div>

          {/* Mode tabs */}
          <div className="flex gap-1 mb-5 bg-[var(--cream-dark)] p-1 rounded-[var(--radius-md)] w-fit mx-auto">
            {(["type", "upload"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`
                  px-4 py-1.5 text-[13px] font-medium rounded-[6px]
                  font-[family-name:var(--font-body)]
                  transition-all duration-150 cursor-pointer
                  ${
                    mode === m
                      ? "bg-[var(--paper)] text-[var(--ink)] shadow-[var(--shadow-sm)]"
                      : "text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]"
                  }
                `}
              >
                {m === "type" ? "Type problem" : "Upload image"}
              </button>
            ))}
          </div>

          {/* Input area */}
          <div className="space-y-4">
            {mode === "upload" ? (
              <>
                {!file && <UploadZone onFile={setFile} disabled={loading} />}
                {file && (
                  <UploadPreview file={file} onRemove={() => setFile(null)} />
                )}
              </>
            ) : (
              <TextInputArea
                value={text}
                onChange={setText}
                disabled={loading}
              />
            )}

            {mode === "upload" && file && (
              <TextInputArea
                value={text}
                onChange={setText}
                disabled={loading}
              />
            )}

            {error && (
              <p className="text-[13px] text-[var(--error)] font-[family-name:var(--font-body)]">
                {error}
              </p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!hasInput || loading}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <Spinner size={16} />
                  <span>
                    {lessonFormat === "micro"
                      ? "Generating micro-lesson..."
                      : "Analyzing..."}
                  </span>
                </>
              ) : (
                lessonFormat === "micro" ? "Generate micro-lesson" : "Start lesson"
              )}
            </Button>
          </div>

          <div className="mt-7 space-y-4">
            <div>
              <p className="text-[12px] text-[var(--ink-tertiary)] mb-2 font-[family-name:var(--font-body)]">
                Try an example:
              </p>
              <div className="space-y-2">
                {EXAMPLE_PROBLEMS.map((example) => (
                  <button
                    key={example.text}
                    onClick={() => {
                      setMode("type");
                      setSubjectHint(example.subject);
                      setText(example.text);
                    }}
                    className="w-full text-left rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper)] px-3 py-2 hover:bg-[var(--cream-dark)] transition-colors cursor-pointer"
                  >
                    <p className="text-[11px] text-[var(--ink-tertiary)]">{example.subject}</p>
                    <p className="text-[13px] text-[var(--ink-secondary)] leading-relaxed">
                      {example.text}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {recentProblems.length > 0 && (
              <div>
                <p className="text-[12px] text-[var(--ink-tertiary)] mb-2 font-[family-name:var(--font-body)]">
                  Recent problems:
                </p>
                <div className="flex flex-wrap gap-2">
                  {recentProblems.map((problem) => (
                    <button
                      key={problem}
                      onClick={() => {
                        setMode("type");
                        setText(problem);
                      }}
                      className="max-w-full truncate rounded-full border border-[var(--border)] bg-[var(--paper)] px-3 py-1 text-[11px] text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)] transition-colors cursor-pointer"
                      title={problem}
                    >
                      {problem}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
