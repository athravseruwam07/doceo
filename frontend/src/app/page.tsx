"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import LessonLoadingScreen from "@/components/ui/LoadingOverlay";
import Spinner from "@/components/ui/Spinner";
import { useTheme } from "@/hooks/useTheme";
import { useUpload } from "@/hooks/useUpload";
import {
  createExamCramPlanUpload,
  createSession as createExamSession,
  createCourse,
  deleteCourse,
  getSessionHistory,
  listCourseLessons,
  listCourseMaterials,
  listCourses,
  uploadCourseMaterial,
} from "@/lib/api";
import {
  CourseLesson,
  CourseMaterial,
  CourseSummary,
  ExamCramResponse,
  SessionHistoryItem,
} from "@/lib/types";

type LessonFormat = "full" | "micro";
type SidebarMode = "ask" | "courses" | "exam-cram" | "history";

function toSidebarMode(value: string | null): SidebarMode | null {
  if (value === "ask" || value === "courses" || value === "exam-cram" || value === "history") {
    return value;
  }
  return null;
}

export default function Home() {
  const router = useRouter();
  const { toggleTheme } = useTheme();
  const {
    file,
    setFile,
    text,
    setText,
    courseId,
    setCourseId,
    loading,
    error,
    submit,
  } = useUpload();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [sidebarMode, setSidebarMode] = useState<SidebarMode>("ask");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [lessonFormat, setLessonFormat] = useState<LessonFormat>("full");
  const [microVoiceEnabled, setMicroVoiceEnabled] = useState(true);

  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);

  const [coursesLoading, setCoursesLoading] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [notesUploading, setNotesUploading] = useState(false);

  const [newCourseLabel, setNewCourseLabel] = useState("");
  const [notesFile, setNotesFile] = useState<File | null>(null);
  const [courseError, setCourseError] = useState<string | null>(null);

  const [examName, setExamName] = useState("");
  const [examNotes, setExamNotes] = useState("");
  const [examFiles, setExamFiles] = useState<File[]>([]);
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [examResult, setExamResult] = useState<ExamCramResponse | null>(null);

  const [historyItems, setHistoryItems] = useState<SessionHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loadingRunKey, setLoadingRunKey] = useState<string | null>(null);

  useEffect(() => {
    const syncModeFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      setSidebarMode(toSidebarMode(params.get("view")) ?? "ask");
    };

    syncModeFromUrl();
    window.addEventListener("popstate", syncModeFromUrl);
    return () => window.removeEventListener("popstate", syncModeFromUrl);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadCourses = async () => {
      setCoursesLoading(true);
      try {
        const items = await listCourses();
        if (cancelled) return;
        setCourses(items);
        setCourseError(null);
        setCourseId((current) => {
          if (current && items.some((item) => item.course_id === current)) {
            return current;
          }
          return items[0]?.course_id ?? "";
        });
      } catch (err) {
        if (!cancelled) {
          setCourseError(err instanceof Error ? err.message : "Failed to load courses");
        }
      } finally {
        if (!cancelled) setCoursesLoading(false);
      }
    };

    void loadCourses();

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

    const loadCourseData = async () => {
      setMaterialsLoading(true);
      setLessonsLoading(true);
      try {
        const [materialItems, lessonItems] = await Promise.all([
          listCourseMaterials(courseId),
          listCourseLessons(courseId),
        ]);
        if (cancelled) return;
        setMaterials(materialItems);
        setLessons(lessonItems);
      } catch (err) {
        if (!cancelled) {
          setCourseError(
            err instanceof Error ? err.message : "Failed to load course data"
          );
        }
      } finally {
        if (!cancelled) {
          setMaterialsLoading(false);
          setLessonsLoading(false);
        }
      }
    };

    void loadCourseData();

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    if (sidebarMode !== "history") return;
    let active = true;

    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const result = await getSessionHistory();
        if (!active) return;
        setHistoryItems(result);
      } catch (err) {
        if (!active) return;
        setHistoryError(
          err instanceof Error ? err.message : "Could not load session history."
        );
      } finally {
        if (active) setHistoryLoading(false);
      }
    };

    void loadHistory();
    return () => {
      active = false;
    };
  }, [sidebarMode]);

  const refreshCourses = async (preferredCourseId?: string) => {
    const items = await listCourses();
    setCourses(items);

    const nextCourseId =
      (preferredCourseId &&
      items.some((course) => course.course_id === preferredCourseId)
        ? preferredCourseId
        : items.some((course) => course.course_id === courseId)
          ? courseId
          : items[0]?.course_id) ?? "";

    setCourseId(nextCourseId);
    return nextCourseId;
  };

  const refreshCourseData = async (selectedCourseId: string) => {
    if (!selectedCourseId) {
      setMaterials([]);
      setLessons([]);
      return;
    }

    const [materialItems, lessonItems] = await Promise.all([
      listCourseMaterials(selectedCourseId),
      listCourseLessons(selectedCourseId),
    ]);
    setMaterials(materialItems);
    setLessons(lessonItems);
  };

  const handleCreateCourse = async () => {
    const label = newCourseLabel.trim();
    if (!label) return;

    setCourseError(null);
    try {
      const created = await createCourse(label);
      setNewCourseLabel("");
      const nextId = await refreshCourses(created.course_id);
      await refreshCourseData(nextId);
    } catch (err) {
      setCourseError(err instanceof Error ? err.message : "Failed to create course");
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
      const nextId = await refreshCourses();
      await refreshCourseData(nextId);
    } catch (err) {
      setCourseError(err instanceof Error ? err.message : "Failed to delete course");
    }
  };

  const handleUploadNotes = async () => {
    if (!courseId || !notesFile) return;

    setCourseError(null);
    setNotesUploading(true);
    try {
      await uploadCourseMaterial(courseId, notesFile);
      setNotesFile(null);
      await refreshCourseData(courseId);
      await refreshCourses(courseId);
    } catch (err) {
      setCourseError(err instanceof Error ? err.message : "Failed to upload notes");
    } finally {
      setNotesUploading(false);
    }
  };

  const handleSubmit = async () => {
    const loadingKey = `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setLoadingRunKey(loadingKey);

    const isMicroLesson = lessonFormat === "micro";
    const sessionId = await submit({
      microLesson: isMicroLesson,
      includeVoice: isMicroLesson ? microVoiceEnabled : true,
    });
    if (!sessionId) {
      setLoadingRunKey(null);
      return;
    }

    router.push(`/lesson/${sessionId}?loadingRun=${loadingKey}`);
  };

  const handleSidebarModeChange = (mode: SidebarMode) => {
    setSidebarMode(mode);
    const params = new URLSearchParams(window.location.search);
    if (mode === "ask") {
      params.delete("view");
    } else {
      params.set("view", mode);
    }
    const query = params.toString();
    router.replace(query ? `/?${query}` : "/", { scroll: false });
  };

  const handleExamCramSubmit = async () => {
    const hasInput = examFiles.length > 0 || examNotes.trim().length > 0;
    if (!hasInput || examLoading) return;

    setExamLoading(true);
    setExamError(null);
    try {
      const session = await createExamSession({
        problem_text: examName.trim()
          ? `Exam Cram Session: ${examName.trim()}`
          : "Exam Cram Session",
      });

      const payload = await createExamCramPlanUpload(session.session_id, {
        files: examFiles,
        notes: examNotes,
        exam_name: examName.trim() || undefined,
      });
      setExamResult(payload);
    } catch (err) {
      setExamError(
        err instanceof Error ? err.message : "Failed to generate exam cram plan."
      );
    } finally {
      setExamLoading(false);
    }
  };

  const handleAskKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!loading) {
        void handleSubmit();
      }
    }
  };

  const selectedCourse = courses.find((course) => course.course_id === courseId) ?? null;
  const canSubmit = Boolean(file || text.trim());
  const hasExamInput = examFiles.length > 0 || examNotes.trim().length > 0;

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

  const formatWhen = (value?: string): string => {
    if (!value) return "Unknown time";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Unknown time";
    return date.toLocaleString();
  };

  const isAskMode = sidebarMode === "ask";
  const isExamCramMode = sidebarMode === "exam-cram";
  const isCoursesMode = sidebarMode === "courses";
  const isHistoryMode = sidebarMode === "history";
  const darkModeContentOffset = sidebarOpen ? "pl-[242px]" : "pl-[86px]";

  const renderModeRail = (activeMode: SidebarMode) => (
    <aside className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-white/10 bg-[#0f1116]/95 p-3 backdrop-blur-sm transition-[width] duration-300 ease-out ${sidebarOpen ? "w-[220px]" : "w-[64px]"}`}>
      <div className="flex items-center">
        <button
          onClick={() => handleSidebarModeChange("ask")}
          className={`overflow-hidden whitespace-nowrap text-left font-[family-name:var(--font-heading)] text-[22px] font-semibold tracking-[-0.01em] text-white transition-all duration-300 ease-out ${
            sidebarOpen
              ? "mr-2 max-w-[140px] opacity-100"
              : "mr-0 max-w-0 opacity-0 pointer-events-none"
          }`}
        >
          Doceo
        </button>
        <button
          onClick={() => setSidebarOpen((open) => !open)}
          className={`rounded-lg border border-white/10 p-1.5 text-white/60 transition-all duration-300 ease-out hover:border-white/20 hover:bg-white/[0.06] hover:text-white/85 ${
            sidebarOpen ? "ml-auto" : "mx-auto"
          }`}
          aria-label={sidebarOpen ? "Close menu" : "Open menu"}
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none">
            <rect x="2.5" y="3" width="15" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8.2 3.8v12.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <nav className="mt-6 space-y-2">
        {(
          [
            {
              mode: "ask",
              label: "Home",
              icon: (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                  <path d="M3 9.5L10 4l7 5.5V16a1 1 0 01-1 1h-4.5v-4h-3v4H4a1 1 0 01-1-1V9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                </svg>
              ),
            },
            {
              mode: "exam-cram",
              label: "Exam Cram",
              icon: (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                  <path d="M6 3.5h8M6 16.5h8M5 4.5h10v11H5zM8 7.5h4M8 10h4M8 12.5h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              mode: "courses",
              label: "Courses",
              icon: (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                  <path d="M3.5 5.5l6.5-2 6.5 2v9L10 16.5l-6.5-2v-9zM10 3.5v13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ),
            },
            {
              mode: "history",
              label: "History",
              icon: (
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M10 6.8v3.5l2.4 1.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              ),
            },
          ] as const
        ).map((item) => (
          <button
            key={item.mode}
            onClick={() => handleSidebarModeChange(item.mode)}
            title={!sidebarOpen ? item.label : undefined}
            className={`w-full border-l-2 px-2 py-2 text-[13px] transition-colors ${
              activeMode === item.mode
                ? "border-l-white text-white"
                : "border-l-transparent text-white/60 hover:border-l-white/40 hover:text-white/85"
            } ${sidebarOpen ? "text-left" : "flex items-center justify-center"}`}
          >
            <span className="inline-flex items-center">
              <span className="text-white/75">{item.icon}</span>
              <span
                className={`overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
                  sidebarOpen
                    ? "ml-2 max-w-[120px] translate-x-0 opacity-100"
                    : "ml-0 max-w-0 -translate-x-1 opacity-0"
                }`}
              >
                {item.label}
              </span>
            </span>
          </button>
        ))}
      </nav>

      <div className={`mt-auto border-t border-white/10 pt-4 transition-all duration-300 ease-out ${sidebarOpen ? "flex items-center justify-between" : "flex flex-col items-center gap-2"}`}>
        <button
          onClick={toggleTheme}
          className="rounded-xl border border-white/10 p-2 text-white/70 hover:border-white/20 hover:bg-white/[0.06]"
          aria-label="Toggle theme"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M10 2v2M10 16v2M2 10h2M16 10h2M4.34 4.34l1.41 1.41M14.24 14.24l1.41 1.41M15.66 4.34l-1.41 1.41M5.76 14.24l-1.41 1.41"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#15803d] text-[12px] font-semibold text-white">
          A
        </span>
      </div>
    </aside>
  );

  if (isAskMode) {
    return (
      <div className="min-h-screen bg-[#0b0f14] text-white">
        {loadingRunKey && (
          <LessonLoadingScreen
            overlay
            persistKey={loadingRunKey}
            phase="lesson"
          />
        )}
        {renderModeRail("ask")}
        <main className={`mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16 transition-[padding-left] duration-300 ease-out ${darkModeContentOffset}`}>
          <section className="mx-auto w-full max-w-2xl">
            <h1 className="text-center font-[family-name:var(--font-heading)] text-[clamp(44px,7vw,74px)] font-semibold leading-[1.05] tracking-[-0.02em] text-white">
              Learn step by step
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-center text-[18px] leading-relaxed text-white/55">
              Type a STEM problem or paste a screenshot. Doceo turns it into an interactive walkthrough and explains every step clearly.
            </p>

            <div className="mt-7 rounded-2xl border border-white/10 bg-[#151923] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleAskKeyDown}
                rows={3}
                placeholder="Type your problem, or paste/drop an image..."
                className="w-full resize-none bg-transparent px-1.5 py-1.5 text-[16px] leading-relaxed text-white outline-none placeholder:text-white/35"
                disabled={loading}
              />

              <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                <div className="flex min-w-0 items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const uploaded = event.target.files?.[0];
                      if (uploaded) setFile(uploaded);
                      event.target.value = "";
                    }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.08] focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]"
                    disabled={loading}
                    aria-label="Attach image"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M7 11.5l5.8-5.8a2.5 2.5 0 113.5 3.5L8.9 16.6a4 4 0 11-5.7-5.7L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {file ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70">
                        {file.name}
                      </span>
                      <button
                        onClick={() => setFile(null)}
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-white/50 hover:border-white/20 hover:text-white/80"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-white/45">Optional: add a screenshot for better steps.</span>
                  )}
                </div>

                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || loading}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#22c55e]/60 bg-[#22c55e] text-white shadow-[0_0_0_0_rgba(34,197,94,0.25)] transition-all hover:bg-[#16a34a] hover:shadow-[0_0_0_4px_rgba(34,197,94,0.18)] focus-visible:shadow-[0_0_0_4px_rgba(34,197,94,0.22)] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-[#273341] disabled:text-white/35 disabled:shadow-none"
                  aria-label="Start lesson"
                >
                  {loading ? (
                    <Spinner size={15} />
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M4 10h10M10 6l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/70">
                Course
                <select
                  className="max-w-[160px] bg-transparent text-[11px] text-white/80 outline-none"
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                >
                  <option value="" className="bg-[#151923] text-white">No course</option>
                  {courses.map((course) => (
                    <option key={course.course_id} value={course.course_id} className="bg-[#151923] text-white">
                      {course.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1">
                <button
                  onClick={() => setLessonFormat("full")}
                  className={`rounded-full px-3 py-1 text-[11px] ${
                    lessonFormat === "full"
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  Full
                </button>
                <button
                  onClick={() => setLessonFormat("micro")}
                  className={`rounded-full px-3 py-1 text-[11px] ${
                    lessonFormat === "micro"
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:bg-white/10"
                  }`}
                >
                  Micro
                </button>
              </div>

              {lessonFormat === "micro" && (
                <label className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-white/70">
                  <input
                    type="checkbox"
                    checked={microVoiceEnabled}
                    onChange={(event) => setMicroVoiceEnabled(event.target.checked)}
                    className="h-3.5 w-3.5 accent-[#22c55e]"
                  />
                  Voice
                </label>
              )}
            </div>

            <p className="mt-5 text-center text-[12px] text-white/35">
              Try: &ldquo;Find the derivative of f(x) = 3x^4 - 2x^2 + 7x - 5&rdquo;
            </p>

            {error && (
              <p className="mt-3 text-center text-[12px] text-[#fca5a5]">{error}</p>
            )}
          </section>
        </main>
      </div>
    );
  }

  if (isExamCramMode) {
    return (
      <div className="min-h-screen bg-[#0b0f14] text-white">
        {renderModeRail("exam-cram")}
        <main className={`mx-auto w-full max-w-6xl px-6 py-14 transition-[padding-left] duration-300 ease-out ${darkModeContentOffset}`}>
          <section className="mx-auto w-full max-w-4xl">
            <h1 className="text-center font-[family-name:var(--font-heading)] text-[clamp(40px,6vw,64px)] font-semibold leading-[1.06] tracking-[-0.02em] text-white">
              Prepare exam-first
            </h1>
            <p className="mx-auto mt-3 max-w-3xl text-center text-[18px] leading-relaxed text-white/55">
              Upload notes, old questions, or study guides. Doceo predicts likely topics and builds focused practice.
            </p>

            <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-3xl border border-white/10 bg-[#151923] p-5 shadow-[0_15px_55px_rgba(0,0,0,0.38)]">
                <p className="text-[11px] uppercase tracking-wide text-white/45">Input</p>

                <label className="mt-3 block text-[12px] text-white/75">
                  Exam name
                  <input
                    value={examName}
                    onChange={(event) => setExamName(event.target.value)}
                    placeholder="e.g. Calculus Midterm 2"
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0d1420] px-3 py-2 text-[13px] text-white outline-none transition-colors placeholder:text-white/35 hover:border-white/15 focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]"
                  />
                </label>

                <label className="mt-4 block text-[12px] text-white/75">
                  Notes or copied materials
                  <textarea
                    value={examNotes}
                    onChange={(event) => setExamNotes(event.target.value)}
                    rows={7}
                    placeholder="Paste lecture summaries, question banks, or textbook snippets..."
                    className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#0d1420] px-3 py-2.5 text-[13px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/35 hover:border-white/15 focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]"
                  />
                </label>

                <div className="mt-4 rounded-xl border border-white/10 bg-[#0d1420] p-3">
                  <label className="text-[12px] text-white/75">
                    Upload files (.txt, .md, etc.)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(event) =>
                      setExamFiles(Array.from(event.target.files || []))
                    }
                    className="mt-2 block w-full text-[12px] text-white/65 file:mr-3 file:rounded-lg file:border file:border-white/15 file:bg-white/[0.05] file:px-3 file:py-1.5 file:text-[11px] file:text-white/85"
                  />
                  {examFiles.length > 0 && (
                    <p className="mt-2 text-[11px] text-white/50">
                      {examFiles.length} file{examFiles.length > 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>

                {examError && (
                  <p className="mt-3 text-[12px] text-[#fca5a5]">{examError}</p>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => void handleExamCramSubmit()}
                    disabled={!hasExamInput || examLoading}
                    className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-xl border border-[#22c55e]/60 bg-[#22c55e] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_0_0_0_rgba(34,197,94,0.25)] transition-all hover:bg-[#16a34a] hover:shadow-[0_0_0_4px_rgba(34,197,94,0.18)] focus-visible:shadow-[0_0_0_4px_rgba(34,197,94,0.22)] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-[#273341] disabled:text-white/35 disabled:shadow-none"
                  >
                    {examLoading ? <Spinner size={15} /> : null}
                    {examLoading ? "Generating..." : "Generate cram plan"}
                  </button>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-[#151923] p-5">
                <p className="text-[11px] uppercase tracking-wide text-white/45">How it works</p>
                <div className="mt-3 space-y-2 text-[13px] text-white/70">
                  <p>1. Parse recurring patterns from your notes and past exam material.</p>
                  <p>2. Rank topics by likely exam relevance.</p>
                  <p>3. Build focused lessons and practice prompts from those topics.</p>
                </div>

                {examResult && examResult.recurring_patterns.length > 0 && (
                  <div className="mt-5 border-t border-white/10 pt-4">
                    <p className="text-[12px] font-medium text-white/85">Recurring patterns</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {examResult.recurring_patterns.slice(0, 6).map((pattern, idx) => (
                        <span
                          key={`${pattern}-${idx}`}
                          className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70"
                        >
                          {pattern}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {examResult && (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <section className="rounded-2xl border border-white/10 bg-[#151923] p-4">
                  <h3 className="text-[16px] font-semibold text-white">Prioritized Topics</h3>
                  <div className="mt-3 space-y-2">
                    {examResult.prioritized_topics.map((topic) => (
                      <div
                        key={topic.topic}
                        className="rounded-xl border border-white/10 bg-[#0d1420] p-3"
                      >
                        <p className="text-[13px] font-medium text-white">{topic.topic}</p>
                        <p className="text-[11px] text-white/50">
                          Priority score: {(topic.likelihood * 100).toFixed(0)} / 100
                        </p>
                        <p className="mt-1 text-[12px] text-white/70">{topic.why}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-white/10 bg-[#151923] p-4">
                  <h3 className="text-[16px] font-semibold text-white">Practice Questions</h3>
                  <div className="mt-3 space-y-2">
                    {examResult.practice_questions.map((question, index) => (
                      <div
                        key={`${question.concept}-${index}`}
                        className="rounded-xl border border-white/10 bg-[#0d1420] p-3"
                      >
                        <p className="text-[11px] text-white/50">
                          {question.difficulty.toUpperCase()} • {question.concept}
                        </p>
                        <p className="mt-1 text-[13px] text-white/80">{question.question}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </section>
        </main>
      </div>
    );
  }

  if (isCoursesMode) {
    return (
      <div className="min-h-screen bg-[#0b0f14] text-white">
        {renderModeRail("courses")}
        <main className={`mx-auto w-full max-w-6xl px-6 py-14 transition-[padding-left] duration-300 ease-out ${darkModeContentOffset}`}>
          <section className="mx-auto w-full max-w-5xl">
            <h1 className="text-center font-[family-name:var(--font-heading)] text-[clamp(40px,6vw,62px)] font-semibold leading-[1.06] tracking-[-0.02em] text-white">
              Keep every course organized
            </h1>
            <p className="mx-auto mt-3 max-w-3xl text-center text-[18px] leading-relaxed text-white/55">
              Create course spaces, upload notes, and reopen saved lessons in one place.
            </p>

            <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-3xl border border-white/10 bg-[#151923] p-5 shadow-[0_15px_55px_rgba(0,0,0,0.38)]">
                <p className="text-[11px] uppercase tracking-wide text-white/45">Courses</p>

                <div className="mt-3 flex gap-2">
                  <input
                    value={newCourseLabel}
                    onChange={(event) => setNewCourseLabel(event.target.value)}
                    placeholder="New course label"
                    className="flex-1 rounded-xl border border-white/10 bg-[#0d1420] px-3 py-2 text-[13px] text-white outline-none transition-colors placeholder:text-white/35 hover:border-white/15 focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]"
                  />
                  <button
                    onClick={handleCreateCourse}
                    className="rounded-xl border border-[#22c55e]/50 bg-[#22c55e] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#16a34a]"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {coursesLoading && (
                    <p className="text-[12px] text-white/55">Loading courses...</p>
                  )}
                  {!coursesLoading && courses.length === 0 && (
                    <p className="text-[12px] text-white/45">No course labels yet.</p>
                  )}

                  {courses.map((course) => {
                    const isSelected = course.course_id === courseId;
                    return (
                      <div
                        key={course.course_id}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d1420] p-2"
                      >
                        <button
                          onClick={() => setCourseId(course.course_id)}
                          className={`flex-1 rounded-lg px-2.5 py-2 text-left text-[12px] ${
                            isSelected
                              ? "bg-[#123021] text-[#8ef5b2]"
                              : "text-white/80 hover:bg-white/[0.06]"
                          }`}
                        >
                          <span className="block truncate font-medium">{course.label}</span>
                          <span className="text-[10px] text-white/45">
                            {course.material_count} files
                          </span>
                        </button>
                        <button
                          onClick={() => void handleDeleteCourse(course)}
                          className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white/55 hover:border-white/20 hover:text-[#fca5a5]"
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-[#151923] p-5">
                <p className="text-[11px] uppercase tracking-wide text-white/45">Upload notes</p>
                <p className="mt-2 text-[12px] text-white/65">
                  Selected course: {selectedCourse ? selectedCourse.label : "None"}
                </p>

                <div className="mt-3 space-y-2">
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,.docx"
                    onChange={(event) => setNotesFile(event.target.files?.[0] ?? null)}
                    disabled={notesUploading}
                    className="w-full text-[12px] text-white/65 file:mr-3 file:rounded-lg file:border file:border-white/15 file:bg-white/[0.05] file:px-3 file:py-1.5 file:text-[11px] file:text-white/85"
                  />
                  <button
                    onClick={() => void handleUploadNotes()}
                    disabled={!courseId || !notesFile || notesUploading}
                    className="rounded-xl border border-[#22c55e]/50 px-3 py-2 text-[12px] font-semibold text-[#8ef5b2] hover:bg-[#123021] disabled:opacity-40"
                  >
                    {notesUploading ? "Uploading..." : "Upload"}
                  </button>
                </div>

                {materialsLoading && (
                  <p className="mt-3 text-[12px] text-white/55">Loading materials...</p>
                )}
                {!materialsLoading && materials.length === 0 && (
                  <p className="mt-3 text-[12px] text-white/45">No materials yet.</p>
                )}

                {materials.length > 0 && (
                  <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto">
                    {materials.map((material) => (
                      <div
                        key={material.material_id}
                        className="rounded-xl border border-white/10 bg-[#0d1420] px-3 py-2.5"
                      >
                        <p className="text-[12px] font-medium text-white/85">
                          {material.filename}
                        </p>
                        <p className="text-[11px] text-white/45">
                          {material.chunk_count} chunks • {material.char_count} chars
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="mt-5 rounded-3xl border border-white/10 bg-[#151923] p-5">
              <h3 className="text-[14px] font-semibold text-white/90">Saved Lessons</h3>

              {lessonsLoading && (
                <p className="mt-3 text-[12px] text-white/55">Loading lessons...</p>
              )}
              {!lessonsLoading && lessons.length === 0 && (
                <p className="mt-3 text-[12px] text-white/45">No lessons saved for this course yet.</p>
              )}

              {lessons.length > 0 && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {lessons.map((lesson) => (
                    <button
                      key={lesson.session_id}
                      onClick={() => router.push(`/lesson/${lesson.session_id}`)}
                      className="rounded-xl border border-white/10 bg-[#0d1420] px-3 py-2.5 text-left hover:border-white/20 hover:bg-[#111b2a]"
                    >
                      <p className="truncate text-[12px] font-medium text-white">{lesson.title}</p>
                      <p className="text-[11px] text-white/50">
                        {lesson.lesson_type === "micro" ? "Micro" : "Full"} • {lesson.subject} • {lesson.step_count} steps
                      </p>
                      <p className="text-[11px] text-white/45">{formatLessonDate(lesson.created_at)}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {courseError && <p className="mt-4 text-[12px] text-[#fca5a5]">{courseError}</p>}
          </section>
        </main>
      </div>
    );
  }

  if (isHistoryMode) {
    return (
      <div className="min-h-screen bg-[#0b0f14] text-white">
        {renderModeRail("history")}
        <main className={`mx-auto w-full max-w-5xl px-6 py-14 transition-[padding-left] duration-300 ease-out ${darkModeContentOffset}`}>
          <h1 className="text-center font-[family-name:var(--font-heading)] text-[clamp(40px,6vw,60px)] font-semibold leading-[1.06] tracking-[-0.02em] text-white">
            Continue from where you left off
          </h1>
          <p className="mx-auto mt-3 max-w-3xl text-center text-[18px] leading-relaxed text-white/55">
            Reopen prior lessons and jump back into explanations, diagrams, and practice.
          </p>

          {historyLoading && (
            <p className="mt-8 text-center text-[13px] text-white/55">Loading history...</p>
          )}
          {historyError && (
            <p className="mt-8 text-center text-[13px] text-[#fca5a5]">{historyError}</p>
          )}

          {!historyLoading && !historyError && historyItems.length === 0 && (
            <p className="mt-8 text-center text-[13px] text-white/50">
              No prior sessions yet.
            </p>
          )}

          <div className="mt-8 space-y-3">
            {historyItems.map((item) => (
              <button
                key={item.session_id}
                onClick={() => router.push(`/lesson/${item.session_id}`)}
                className="block w-full rounded-2xl border border-white/10 bg-[#151923] p-4 text-left transition-colors hover:border-white/20 hover:bg-[#101826]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[16px] font-medium text-white">{item.title}</p>
                  <span className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-white/60">
                    {item.status}
                  </span>
                </div>
                {item.problem_text && (
                  <p className="mt-1 text-[13px] text-white/65 line-clamp-2">
                    {item.problem_text}
                  </p>
                )}
                <p className="mt-2 text-[12px] text-white/45">
                  {item.subject} · {item.step_count} steps · Updated{" "}
                  {formatWhen(item.updated_at || item.created_at)}
                </p>
              </button>
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--cream)] text-[var(--ink)]">
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-30 bg-black/20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar backdrop"
        />
      )}

      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed left-3 top-3 z-50 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-[12px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
        >
          Open Menu
        </button>
      )}

      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-[260px] overflow-y-auto border-r border-[var(--border)] bg-[var(--paper)] p-4 shadow-lg transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="font-[family-name:var(--font-heading)] text-[20px] font-semibold hover:text-[var(--emerald)]"
          >
            Doceo
          </Link>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="rounded-md p-2 text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
              aria-label="Toggle theme"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 20 20">
                <circle cx="10" cy="10" r="4" stroke="currentColor" strokeWidth="1.7" />
                <path
                  d="M10 2v2M10 16v2M2 10h2M16 10h2M4.34 4.34l1.41 1.41M14.24 14.24l1.41 1.41M15.66 4.34l-1.41 1.41M5.76 14.24l-1.41 1.41"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </button>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md p-2 text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
              aria-label="Close sidebar"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => handleSidebarModeChange("ask")}
            className={`w-full rounded-[var(--radius-md)] border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
              sidebarMode === "ask"
                ? "border-[var(--emerald)] bg-[var(--emerald-subtle)] text-[var(--emerald)]"
                : "border-[var(--border)] bg-[var(--paper)] text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
            }`}
          >
            Ask Doceo
          </button>

          <button
            onClick={() => handleSidebarModeChange("courses")}
            className={`w-full rounded-[var(--radius-md)] border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
              sidebarMode === "courses"
                ? "border-[var(--emerald)] bg-[var(--emerald-subtle)] text-[var(--emerald)]"
                : "border-[var(--border)] bg-[var(--paper)] text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
            }`}
          >
            Courses
          </button>

          <button
            onClick={() => handleSidebarModeChange("exam-cram")}
            className={`w-full rounded-[var(--radius-md)] border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
              sidebarMode === "exam-cram"
                ? "border-[var(--emerald)] bg-[var(--emerald-subtle)] text-[var(--emerald)]"
                : "border-[var(--border)] bg-[var(--paper)] text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
            }`}
          >
            Exam Cram
          </button>

          <button
            onClick={() => handleSidebarModeChange("history")}
            className={`w-full rounded-[var(--radius-md)] border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
              sidebarMode === "history"
                ? "border-[var(--emerald)] bg-[var(--emerald-subtle)] text-[var(--emerald)]"
                : "border-[var(--border)] bg-[var(--paper)] text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
            }`}
          >
            History
          </button>
        </div>

        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper-warm)] p-3">
          <p className="text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">Active Course</p>
          <p className="mt-1 text-[13px] text-[var(--ink-secondary)]">
            {selectedCourse ? selectedCourse.label : "No course selected"}
          </p>
        </div>
      </aside>

      <main className={`px-4 py-6 transition-[margin] duration-300 ${sidebarOpen ? "lg:ml-[280px]" : "lg:ml-0"}`}>
        <div className="mx-auto max-w-6xl rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper)] p-5 md:p-7">
          {sidebarMode === "ask" ? (
            <div className="mx-auto w-full max-w-5xl">
              <section className="overflow-hidden rounded-[var(--radius-lg)] border border-white/10 bg-[#101826] text-white">
                <header className="border-b border-white/10 bg-gradient-to-br from-[#0b0f14] to-[#0f1720] px-5 py-6 md:px-6">
                  <p className="text-[10px] uppercase tracking-[0.08em] text-white/60">Doceo Studio</p>
                  <h1 className="mt-2 font-[family-name:var(--font-heading)] text-[clamp(30px,4vw,44px)] font-bold leading-[1.08] text-white">
                    Ask a question
                  </h1>
                  <p className="mt-2 max-w-2xl text-[15px] text-white/75">
                    Type a problem or attach an image. Doceo turns it into a clear, step-by-step lesson.
                  </p>
                </header>

                <div className="grid lg:grid-cols-[300px_1fr]">
                  <aside className="border-b border-white/10 px-5 py-5 lg:border-b-0 lg:border-r md:px-6">
                    <section>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Step 1</p>
                      <p className="mt-1 inline-flex items-center gap-2 text-[13px] font-medium text-white/90">
                        <svg className="h-4 w-4 text-white/60" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M4 5.5h12v10H4zM7 4h6M7 8h6M7 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                        </svg>
                        Course context
                      </p>
                      <select
                        className="mt-2 w-full rounded-[var(--radius-md)] border border-white/10 bg-[#0d1420] px-3 py-2 text-[13px] text-white outline-none transition-colors hover:border-white/20 focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]"
                        value={courseId}
                        onChange={(event) => setCourseId(event.target.value)}
                      >
                        <option value="" className="text-white">No course</option>
                        {courses.map((course) => (
                          <option key={course.course_id} value={course.course_id} className="text-white">
                            {course.label}
                          </option>
                        ))}
                      </select>
                    </section>

                    <section className="mt-5 border-t border-white/10 pt-5">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Step 2</p>
                      <p className="mt-1 inline-flex items-center gap-2 text-[13px] font-medium text-white/90">
                        <svg className="h-4 w-4 text-white/60" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M4 10h12M4 6h12M4 14h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        Lesson format
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setLessonFormat("full")}
                          className={`rounded-[var(--radius-sm)] border px-3 py-2 text-[12px] font-medium transition-colors ${
                            lessonFormat === "full"
                              ? "border-[#22c55e] bg-[#123021] text-[#8ef5b2]"
                              : "border-white/10 bg-[#0d1420] text-white/75 hover:border-white/20"
                          }`}
                        >
                          Full Lesson
                        </button>
                        <button
                          onClick={() => setLessonFormat("micro")}
                          className={`rounded-[var(--radius-sm)] border px-3 py-2 text-[12px] font-medium transition-colors ${
                            lessonFormat === "micro"
                              ? "border-[#22c55e] bg-[#123021] text-[#8ef5b2]"
                              : "border-white/10 bg-[#0d1420] text-white/75 hover:border-white/20"
                          }`}
                        >
                          Micro Lesson
                        </button>
                      </div>
                      {lessonFormat === "micro" && (
                        <label className="mt-3 inline-flex items-center gap-2 text-[12px] text-white/75">
                          <input
                            type="checkbox"
                            checked={microVoiceEnabled}
                            onChange={(event) => setMicroVoiceEnabled(event.target.checked)}
                            className="h-3.5 w-3.5 accent-[#22c55e]"
                          />
                          Include voice narration
                        </label>
                      )}
                    </section>
                  </aside>

                  <section className="px-5 py-5 md:px-6">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/55">Step 3</p>
                        <p className="mt-1 text-[13px] font-medium text-white/90">Write your prompt</p>
                      </div>
                      <p className="text-[11px] text-white/45">Press Enter to start. Shift + Enter adds a new line.</p>
                    </div>

                    {file && (
                      <div className="mb-3 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-white/10 bg-[#0d1420] px-3 py-2 text-[12px]">
                        <span className="truncate text-white/75">Attached image: {file.name}</span>
                        <button
                          onClick={() => setFile(null)}
                          className="rounded px-2 py-1 text-white/50 hover:bg-white/10 hover:text-white/80"
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    <textarea
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      onKeyDown={handleAskKeyDown}
                      rows={6}
                      placeholder="Type your question here, or attach an image and add context..."
                      className="w-full resize-none rounded-[var(--radius-md)] border border-white/10 bg-[#0d1420] px-3 py-2.5 text-[13px] leading-relaxed text-white outline-none transition-colors placeholder:text-white/35 hover:border-white/15 focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]"
                      disabled={loading}
                    />

                    <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                      <div className="space-y-1">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const uploaded = event.target.files?.[0];
                            if (uploaded) setFile(uploaded);
                            event.target.value = "";
                          }}
                        />
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-white/10 bg-[#0d1420] px-3 py-2 text-[12px] text-white/80 transition-colors hover:border-white/20 hover:bg-[#111b2a] focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,0.25)]"
                          disabled={loading}
                        >
                          <svg className="h-4 w-4 text-white/60" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="M7 11.5l5.8-5.8a2.5 2.5 0 113.5 3.5L8.9 16.6a4 4 0 11-5.7-5.7L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Attach image
                        </button>
                        <p className="text-[11px] text-white/45">Optional: add a screenshot for better steps.</p>
                      </div>

                      <button
                        onClick={() => void handleSubmit()}
                        disabled={!canSubmit || loading}
                        className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[#22c55e]/50 bg-[#22c55e] px-4 py-2 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(34,197,94,0.2)] transition-all hover:bg-[#16a34a] hover:shadow-[0_0_0_3px_rgba(34,197,94,0.22)] disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-[#243448] disabled:text-white/45 disabled:shadow-none"
                      >
                        {loading ? <Spinner size={15} /> : null}
                        {loading ? "Starting..." : "Start Lesson"}
                      </button>
                    </div>
                  </section>
                </div>
              </section>

              {error && <p className="mt-3 text-[12px] text-[var(--error)]">{error}</p>}
            </div>
          ) : sidebarMode === "courses" ? (
            <div className="mx-auto w-full max-w-4xl">
              <h2 className="font-[family-name:var(--font-heading)] text-[26px] font-semibold">
                Courses
              </h2>
              <p className="mt-1 text-[13px] text-[var(--ink-tertiary)]">
                Create course labels, upload notes, and reopen saved lessons.
              </p>

              <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper-warm)] p-4">
                <div className="flex gap-2">
                  <input
                    value={newCourseLabel}
                    onChange={(event) => setNewCourseLabel(event.target.value)}
                    placeholder="New course label"
                    className="flex-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-[13px]"
                  />
                  <button
                    onClick={handleCreateCourse}
                    className="rounded-[var(--radius-md)] bg-[var(--emerald)] px-3 py-2 text-[12px] text-white hover:bg-[var(--emerald-light)]"
                  >
                    Add
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {coursesLoading && (
                    <p className="text-[12px] text-[var(--ink-tertiary)]">Loading courses...</p>
                  )}
                  {!coursesLoading && courses.length === 0 && (
                    <p className="text-[12px] text-[var(--ink-faint)]">No course labels yet.</p>
                  )}

                  {courses.map((course) => {
                    const isSelected = course.course_id === courseId;
                    return (
                      <div
                        key={course.course_id}
                        className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper)] p-2"
                      >
                        <button
                          onClick={() => setCourseId(course.course_id)}
                          className={`flex-1 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-[12px] ${
                            isSelected
                              ? "bg-[var(--emerald-subtle)] text-[var(--emerald)]"
                              : "text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
                          }`}
                        >
                          <span className="block truncate font-medium">{course.label}</span>
                          <span className="text-[10px] text-[var(--ink-faint)]">
                            {course.material_count} files
                          </span>
                        </button>
                        <button
                          onClick={() => void handleDeleteCourse(course)}
                          className="rounded-[var(--radius-sm)] border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--ink-faint)] hover:text-[var(--error)]"
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper-warm)] p-4">
                  <h3 className="text-[14px] font-semibold">Upload Notes</h3>
                  <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">
                    Selected course: {selectedCourse ? selectedCourse.label : "None"}
                  </p>

                  <div className="mt-3 space-y-2">
                    <input
                      type="file"
                      accept=".txt,.md,.pdf,.docx"
                      onChange={(event) => setNotesFile(event.target.files?.[0] ?? null)}
                      disabled={notesUploading}
                      className="w-full text-[12px] text-[var(--ink-secondary)] file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--paper)] file:px-3 file:py-1.5"
                    />
                    <button
                      onClick={() => void handleUploadNotes()}
                      disabled={!courseId || !notesFile || notesUploading}
                      className="rounded-[var(--radius-md)] border border-[var(--emerald)] px-3 py-2 text-[12px] text-[var(--emerald)] hover:bg-[var(--emerald-subtle)] disabled:opacity-40"
                    >
                      {notesUploading ? "Uploading..." : "Upload"}
                    </button>
                  </div>

                  {materialsLoading && (
                    <p className="mt-3 text-[12px] text-[var(--ink-tertiary)]">Loading materials...</p>
                  )}
                  {!materialsLoading && materials.length === 0 && (
                    <p className="mt-3 text-[12px] text-[var(--ink-faint)]">No materials yet.</p>
                  )}

                  {materials.length > 0 && (
                    <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto">
                      {materials.map((material) => (
                        <div
                          key={material.material_id}
                          className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--paper)] px-2.5 py-2"
                        >
                          <p className="text-[12px] font-medium text-[var(--ink-secondary)]">
                            {material.filename}
                          </p>
                          <p className="text-[11px] text-[var(--ink-faint)]">
                            {material.chunk_count} chunks • {material.char_count} chars
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper-warm)] p-4">
                  <h3 className="text-[14px] font-semibold">Saved Lessons</h3>

                  {lessonsLoading && (
                    <p className="mt-3 text-[12px] text-[var(--ink-tertiary)]">Loading lessons...</p>
                  )}
                  {!lessonsLoading && lessons.length === 0 && (
                    <p className="mt-3 text-[12px] text-[var(--ink-faint)]">No lessons saved for this course yet.</p>
                  )}

                  {lessons.length > 0 && (
                    <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto">
                      {lessons.map((lesson) => (
                        <button
                          key={lesson.session_id}
                          onClick={() => router.push(`/lesson/${lesson.session_id}`)}
                          className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-left hover:bg-[var(--cream-dark)]"
                        >
                          <p className="truncate text-[12px] font-medium text-[var(--ink)]">{lesson.title}</p>
                          <p className="text-[11px] text-[var(--ink-faint)]">
                            {lesson.lesson_type === "micro" ? "Micro" : "Full"} • {lesson.subject} • {lesson.step_count} steps
                          </p>
                          <p className="text-[11px] text-[var(--ink-faint)]">{formatLessonDate(lesson.created_at)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {courseError && <p className="mt-4 text-[12px] text-[var(--error)]">{courseError}</p>}
            </div>
          ) : sidebarMode === "exam-cram" ? (
            <div className="mx-auto w-full max-w-5xl">
              <h2 className="font-[family-name:var(--font-heading)] text-[26px] font-semibold">
                Exam Cram Mode
              </h2>
              <p className="mt-1 text-[13px] text-[var(--ink-tertiary)]">
                Upload past exams, lecture notes, or textbook excerpts. Doceo will
                prioritize likely topics and generate focused practice.
              </p>

              <div className="mt-5 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper-warm)] p-4">
                <div className="grid gap-4">
                  <div>
                    <label className="text-[12px] text-[var(--ink-tertiary)]">Exam name</label>
                    <input
                      value={examName}
                      onChange={(event) => setExamName(event.target.value)}
                      placeholder="e.g. Calculus Midterm 2"
                      className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-[13px]"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="text-[12px] text-[var(--ink-tertiary)]">
                    Notes or copied materials
                  </label>
                  <textarea
                    value={examNotes}
                    onChange={(event) => setExamNotes(event.target.value)}
                    rows={7}
                    placeholder="Paste lecture summaries, question banks, or textbook snippets..."
                    className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper)] px-3 py-2 text-[13px]"
                  />
                </div>

                <div className="mt-4">
                  <label className="text-[12px] text-[var(--ink-tertiary)]">
                    Upload files (.txt, .md, etc.)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(event) =>
                      setExamFiles(Array.from(event.target.files || []))
                    }
                    className="mt-1 block w-full text-[12px] text-[var(--ink-secondary)] file:mr-3 file:rounded-md file:border file:border-[var(--border)] file:bg-[var(--paper)] file:px-3 file:py-1.5"
                  />
                  {examFiles.length > 0 && (
                    <p className="mt-1 text-[12px] text-[var(--ink-tertiary)]">
                      {examFiles.length} file{examFiles.length > 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>

                {examError && (
                  <p className="mt-4 text-[12px] text-[var(--error)]">{examError}</p>
                )}

                <button
                  onClick={() => void handleExamCramSubmit()}
                  disabled={!hasExamInput || examLoading}
                  className="mt-4 inline-flex min-w-[180px] items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--emerald)] px-4 py-2 text-[13px] font-medium text-white hover:bg-[var(--emerald-light)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {examLoading ? <Spinner size={15} /> : null}
                  {examLoading ? "Generating..." : "Generate exam cram plan"}
                </button>
              </div>

              {examResult && (
                <div className="mt-5 space-y-4">
                  <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper-warm)] p-4">
                    <h3 className="text-[16px] font-semibold">Prioritized Topics</h3>
                    <div className="mt-3 space-y-2">
                      {examResult.prioritized_topics.map((topic) => (
                        <div
                          key={topic.topic}
                          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper)] p-3"
                        >
                          <p className="text-[13px] font-medium">{topic.topic}</p>
                          <p className="text-[12px] text-[var(--ink-tertiary)]">
                            Priority score: {(topic.likelihood * 100).toFixed(0)} / 100
                          </p>
                          <p className="mt-1 text-[12px] text-[var(--ink-secondary)]">
                            {topic.why}
                          </p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper-warm)] p-4">
                    <h3 className="text-[16px] font-semibold">Practice Questions</h3>
                    <div className="mt-3 space-y-2">
                      {examResult.practice_questions.map((question, index) => (
                        <div
                          key={`${question.concept}-${index}`}
                          className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--paper)] p-3"
                        >
                          <p className="text-[12px] text-[var(--ink-tertiary)]">
                            {question.difficulty.toUpperCase()} • {question.concept}
                          </p>
                          <p className="mt-1 text-[13px]">{question.question}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          ) : (
            <div className="mx-auto w-full max-w-5xl">
              <h2 className="font-[family-name:var(--font-heading)] text-[26px] font-semibold">
                Question History
              </h2>
              <p className="mt-1 text-[13px] text-[var(--ink-tertiary)]">
                Reopen prior lessons and continue where you left off.
              </p>

              {historyLoading && (
                <p className="mt-4 text-[13px] text-[var(--ink-tertiary)]">Loading history...</p>
              )}
              {historyError && (
                <p className="mt-4 text-[13px] text-[var(--error)]">{historyError}</p>
              )}

              {!historyLoading && !historyError && historyItems.length === 0 && (
                <p className="mt-4 text-[13px] text-[var(--ink-tertiary)]">
                  No prior sessions yet.
                </p>
              )}

              <div className="mt-5 space-y-3">
                {historyItems.map((item) => (
                  <button
                    key={item.session_id}
                    onClick={() => router.push(`/lesson/${item.session_id}`)}
                    className="block w-full rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--paper-warm)] p-4 text-left hover:bg-[var(--cream-dark)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[15px] font-medium text-[var(--ink)]">{item.title}</p>
                      <span className="text-[12px] text-[var(--ink-tertiary)]">{item.status}</span>
                    </div>
                    {item.problem_text && (
                      <p className="mt-1 text-[13px] text-[var(--ink-secondary)] line-clamp-2">
                        {item.problem_text}
                      </p>
                    )}
                    <p className="mt-2 text-[12px] text-[var(--ink-tertiary)]">
                      {item.subject} · {item.step_count} steps · Updated{" "}
                      {formatWhen(item.updated_at || item.created_at)}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
