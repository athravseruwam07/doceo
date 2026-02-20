"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";

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
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
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
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin?callbackUrl=%2Fapp");
    }
  }, [router, status]);

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

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current) return;
      if (profileMenuRef.current.contains(event.target as Node)) return;
      setProfileMenuOpen(false);
      setSettingsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setProfileMenuOpen(false);
      setSettingsOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [profileMenuOpen]);

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
    router.replace(query ? `/app?${query}` : "/app", { scroll: false });
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
  const isDarkTheme = theme === "dark";
  const appFrameClass = isDarkTheme
    ? "min-h-screen bg-[#0b0f14] text-white"
    : "min-h-screen bg-[var(--cream)] text-[var(--ink)]";
  const modeTitleClass = `text-center font-[family-name:var(--font-heading)] font-semibold leading-[1.06] tracking-[-0.02em] ${
    isDarkTheme ? "text-white" : "text-[var(--ink)]"
  }`;
  const modeLeadClass = `mx-auto mt-3 max-w-3xl text-center text-[18px] leading-relaxed ${
    isDarkTheme ? "text-white/55" : "text-[var(--ink-tertiary)]"
  }`;
  const modeCardClass = isDarkTheme
    ? "rounded-3xl border border-white/10 bg-[#151923] p-5 shadow-[0_15px_55px_rgba(0,0,0,0.38)]"
    : "rounded-3xl border border-[var(--border)] bg-[var(--paper)] p-5 shadow-[var(--shadow-md)]";
  const modeCardFlatClass = isDarkTheme
    ? "rounded-3xl border border-white/10 bg-[#151923] p-5"
    : "rounded-3xl border border-[var(--border)] bg-[var(--paper)] p-5";
  const modeInnerCardClass = isDarkTheme
    ? "rounded-xl border border-white/10 bg-[#0d1420] p-3"
    : "rounded-xl border border-[var(--border)] bg-[var(--paper-warm)] p-3";
  const modeTextStrongClass = isDarkTheme ? "text-white" : "text-[var(--ink)]";
  const modeTextBodyClass = isDarkTheme ? "text-white/80" : "text-[var(--ink-secondary)]";
  const modeTextSecondaryClass = isDarkTheme ? "text-white/70" : "text-[var(--ink-secondary)]";
  const modeTextMutedClass = isDarkTheme ? "text-white/55" : "text-[var(--ink-tertiary)]";
  const modeTextSubtleClass = isDarkTheme ? "text-white/45" : "text-[var(--ink-faint)]";
  const modeLabelClass = isDarkTheme ? "text-[12px] text-white/75" : "text-[12px] text-[var(--ink-secondary)]";
  const modeInputClass = isDarkTheme
    ? "rounded-xl border border-white/10 bg-[#0d1420] text-white placeholder:text-white/35 hover:border-white/15"
    : "rounded-xl border border-[var(--border)] bg-[var(--paper-warm)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] hover:border-[var(--border-strong)]";
  const modeFileInputClass = isDarkTheme
    ? "text-white/65 file:border-white/15 file:bg-white/[0.05] file:text-white/85"
    : "text-[var(--ink-secondary)] file:border-[var(--border)] file:bg-[var(--paper)] file:text-[var(--ink-secondary)]";
  const modeChipClass = isDarkTheme
    ? "rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] text-white/70"
    : "rounded-full border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-1 text-[11px] text-[var(--ink-secondary)]";
  const modeErrorClass = isDarkTheme ? "text-[#fca5a5]" : "text-[var(--error)]";
  const modeResultCardClass = isDarkTheme
    ? "rounded-2xl border border-white/10 bg-[#151923] p-4"
    : "rounded-2xl border border-[var(--border)] bg-[var(--paper)] p-4";
  const modeResultItemClass = isDarkTheme
    ? "rounded-xl border border-white/10 bg-[#0d1420] p-3"
    : "rounded-xl border border-[var(--border)] bg-[var(--paper-warm)] p-3";
  const darkModeContentOffset = sidebarOpen ? "pl-[242px]" : "pl-[86px]";
  const profileInitial =
    session?.user?.name?.charAt(0).toUpperCase() ||
    session?.user?.email?.charAt(0).toUpperCase() ||
    "?";

  const profileMenu = (
    <div ref={profileMenuRef} className="fixed right-4 top-4 z-[75]">
      <button
        type="button"
        onClick={() => {
          setProfileMenuOpen((open) => !open);
          if (profileMenuOpen) setSettingsOpen(false);
        }}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--paper)] px-2 py-1.5 text-[var(--ink)] shadow-[var(--shadow-sm)] transition-colors hover:bg-[var(--paper-warm)]"
        aria-haspopup="menu"
        aria-expanded={profileMenuOpen}
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--emerald-subtle)] text-[12px] font-semibold text-[var(--emerald)]">
          {profileInitial}
        </span>
        <svg className="h-4 w-4 text-[var(--ink-tertiary)]" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {profileMenuOpen && (
        <div
          className="mt-2 w-64 rounded-xl border border-[var(--border)] bg-[var(--paper)] p-2 shadow-[var(--shadow-lg)]"
          role="menu"
        >
          <div className="rounded-lg border border-[var(--border)] bg-[var(--paper-warm)] px-3 py-2">
            <p className="truncate text-[13px] font-medium text-[var(--ink)]">
              {session?.user?.name || "Signed in"}
            </p>
            <p className="truncate text-[12px] text-[var(--ink-tertiary)]">
              {session?.user?.email || "Account"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen((open) => !open)}
            className="mt-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--cream-dark)] hover:text-[var(--ink)]"
          >
            <span>Settings</span>
            <svg className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {settingsOpen && (
            <div className="mt-1 rounded-lg border border-[var(--border)] bg-[var(--paper-warm)] p-2">
              <p className="px-1 text-[11px] uppercase tracking-wide text-[var(--ink-faint)]">
                Appearance
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`rounded-md px-2 py-1.5 text-[12px] ${
                    theme === "light"
                      ? "bg-[var(--emerald)] text-white"
                      : "bg-[var(--paper)] text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
                  }`}
                >
                  Light
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`rounded-md px-2 py-1.5 text-[12px] ${
                    theme === "dark"
                      ? "bg-[var(--emerald)] text-white"
                      : "bg-[var(--paper)] text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
                  }`}
                >
                  Dark
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="mt-2 w-full rounded-lg px-3 py-2 text-left text-[13px] text-[var(--error)] transition-colors hover:bg-[var(--error-bg)]"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );

  if (status === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--cream)]">
        <Spinner size={28} />
      </div>
    );
  }

  const renderModeRail = (activeMode: SidebarMode) => (
    <aside
      className="fixed left-0 top-0 z-50 flex h-screen flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--paper)]/95 backdrop-blur-sm transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
      style={{
        width: sidebarOpen ? 220 : 72,
        padding: sidebarOpen ? "0.75rem" : "0.625rem",
      }}
    >
      <div className="flex items-center">
        <button
          onClick={() => handleSidebarModeChange("ask")}
          className={`overflow-hidden whitespace-nowrap text-left font-[family-name:var(--font-heading)] text-[22px] font-semibold tracking-[-0.01em] text-[var(--ink)] transition-[max-width,opacity,margin,transform] duration-300 ease-out ${
            sidebarOpen
              ? "mr-2 max-w-[140px] translate-x-0 opacity-100"
              : "mr-0 max-w-0 -translate-x-2 opacity-0 pointer-events-none"
          }`}
        >
          Doceo
        </button>
        <button
          onClick={() => setSidebarOpen((open) => !open)}
          className={`rounded-lg border border-[var(--border)] p-1.5 text-[var(--ink-secondary)] transition-all duration-300 ease-out hover:border-[var(--border-strong)] hover:bg-[var(--cream-dark)] hover:text-[var(--ink)] ${
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
        ).map((item) => {
          const isActive = activeMode === item.mode;
          return (
            <button
              key={item.mode}
              onClick={() => handleSidebarModeChange(item.mode)}
              title={!sidebarOpen ? item.label : undefined}
              className={`text-[13px] transition-all duration-300 ease-out ${
                sidebarOpen
                  ? `w-full border-l-2 px-2 py-2 text-left ${
                      isActive
                        ? isDarkTheme
                          ? "border-l-[#22c55e] bg-white/[0.04] text-[#8ef5b2]"
                          : "border-l-[var(--emerald)] bg-[var(--emerald-subtle)] text-[var(--emerald-dark)]"
                        : isDarkTheme
                          ? "border-l-transparent text-white/55 hover:border-l-white/20 hover:text-white/85"
                          : "border-l-transparent text-[var(--ink-tertiary)] hover:border-l-[var(--border-strong)] hover:text-[var(--ink)]"
                    }`
                  : `mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-transparent ${
                      isActive
                        ? isDarkTheme
                          ? "bg-white/[0.08] text-[#8ef5b2]"
                          : "bg-[var(--emerald-subtle)] text-[var(--emerald-dark)]"
                        : isDarkTheme
                          ? "text-white/55 hover:bg-white/[0.05] hover:text-white/85"
                          : "text-[var(--ink-tertiary)] hover:bg-[var(--cream-dark)] hover:text-[var(--ink)]"
                    }`
              }`}
            >
              <span className={`inline-flex items-center ${sidebarOpen ? "" : "justify-center"}`}>
                <span
                  className={
                    isActive
                      ? isDarkTheme
                        ? "text-[#8ef5b2]"
                        : "text-[var(--emerald-dark)]"
                      : isDarkTheme
                        ? "text-white/45"
                        : "text-[var(--ink-tertiary)]"
                  }
                >
                  {item.icon}
                </span>
                <span
                  className={`overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin,transform] duration-300 ease-out ${
                    sidebarOpen
                      ? "ml-2 max-w-[120px] translate-x-0 opacity-100"
                      : "ml-0 max-w-0 -translate-x-2 opacity-0 pointer-events-none"
                  }`}
                >
                  {item.label}
                </span>
              </span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-[var(--border)] pt-4 text-[11px] text-[var(--ink-faint)]">
        {sidebarOpen ? "Signed in" : ""}
      </div>
    </aside>
  );

  if (isAskMode) {
    return (
      <div className={appFrameClass}>
        {loadingRunKey && (
          <LessonLoadingScreen
            overlay
            persistKey={loadingRunKey}
            phase="lesson"
          />
        )}
        {profileMenu}
        {renderModeRail("ask")}
        <main className={`mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16 transition-[padding-left] duration-300 ease-out ${darkModeContentOffset}`}>
          <section className="mx-auto w-full max-w-2xl">
            <h1
              className={`text-center font-[family-name:var(--font-heading)] text-[clamp(44px,7vw,74px)] font-semibold leading-[1.05] tracking-[-0.02em] ${
                isDarkTheme ? "text-white" : "text-[var(--ink)]"
              }`}
            >
              Learn step by step
            </h1>
            <p
              className={`mx-auto mt-3 max-w-2xl text-center text-[18px] leading-relaxed ${
                isDarkTheme ? "text-white/55" : "text-[var(--ink-tertiary)]"
              }`}
            >
              Type a STEM problem or paste a screenshot. Doceo turns it into an interactive walkthrough and explains every step clearly.
            </p>

            <div
              className={`mt-7 rounded-2xl border p-3 ${
                isDarkTheme
                  ? "border-white/10 bg-[#151923] shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
                  : "border-[var(--border)] bg-[var(--paper)] shadow-[var(--shadow-md)]"
              }`}
            >
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleAskKeyDown}
                rows={3}
                placeholder="Type your problem, or paste/drop an image..."
                className={`w-full resize-none bg-transparent px-1.5 py-1.5 text-[16px] leading-relaxed outline-none ${
                  isDarkTheme
                    ? "text-white placeholder:text-white/35"
                    : "text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
                }`}
                disabled={loading}
              />

              <div
                className={`mt-3 flex items-center justify-between gap-3 border-t pt-3 ${
                  isDarkTheme ? "border-white/10" : "border-[var(--border)]"
                }`}
              >
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
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,0.25)] ${
                      isDarkTheme
                        ? "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/20 hover:bg-white/[0.08]"
                        : "border-[var(--border)] bg-[var(--paper-warm)] text-[var(--ink-tertiary)] hover:border-[var(--border-strong)] hover:bg-[var(--cream-dark)]"
                    }`}
                    disabled={loading}
                    aria-label="Attach image"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                      <path d="M7 11.5l5.8-5.8a2.5 2.5 0 113.5 3.5L8.9 16.6a4 4 0 11-5.7-5.7L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {file ? (
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`truncate rounded-full border px-3 py-1 text-[11px] ${
                          isDarkTheme
                            ? "border-white/10 bg-white/[0.03] text-white/70"
                            : "border-[var(--border)] bg-[var(--paper-warm)] text-[var(--ink-secondary)]"
                        }`}
                      >
                        {file.name}
                      </span>
                      <button
                        onClick={() => setFile(null)}
                        className={`rounded-full border px-2 py-1 text-[11px] transition-colors ${
                          isDarkTheme
                            ? "border-white/10 text-white/50 hover:border-white/20 hover:text-white/80"
                            : "border-[var(--border)] text-[var(--ink-faint)] hover:border-[var(--border-strong)] hover:text-[var(--ink-secondary)]"
                        }`}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <span
                      className={`text-[11px] ${
                        isDarkTheme ? "text-white/45" : "text-[var(--ink-tertiary)]"
                      }`}
                    >
                      Optional: add a screenshot for better steps.
                    </span>
                  )}
                </div>

                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || loading}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#22c55e]/60 bg-[#22c55e] text-white shadow-[0_0_0_0_rgba(34,197,94,0.25)] transition-all hover:bg-[#16a34a] hover:shadow-[0_0_0_4px_rgba(34,197,94,0.18)] focus-visible:shadow-[0_0_0_4px_rgba(34,197,94,0.22)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--cream-dark)] disabled:text-[var(--ink-faint)] disabled:shadow-none"
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
              <label
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] ${
                  isDarkTheme
                    ? "border-white/10 bg-white/[0.03] text-white/70"
                    : "border-[var(--border)] bg-[var(--paper)] text-[var(--ink-secondary)]"
                }`}
              >
                Course
                <select
                  className={`max-w-[160px] bg-transparent text-[11px] outline-none ${
                    isDarkTheme ? "text-white/80" : "text-[var(--ink)]"
                  }`}
                  value={courseId}
                  onChange={(event) => setCourseId(event.target.value)}
                >
                  <option
                    value=""
                    className={isDarkTheme ? "bg-[#151923] text-white" : "bg-[var(--paper)] text-[var(--ink)]"}
                  >
                    No course
                  </option>
                  {courses.map((course) => (
                    <option
                      key={course.course_id}
                      value={course.course_id}
                      className={isDarkTheme ? "bg-[#151923] text-white" : "bg-[var(--paper)] text-[var(--ink)]"}
                    >
                      {course.label}
                    </option>
                  ))}
                </select>
              </label>

              <div
                className={`inline-flex items-center gap-1 rounded-full border p-1 ${
                  isDarkTheme
                    ? "border-white/10 bg-white/[0.03]"
                    : "border-[var(--border)] bg-[var(--paper)]"
                }`}
              >
                <button
                  onClick={() => setLessonFormat("full")}
                  className={`rounded-full px-3 py-1 text-[11px] ${
                    lessonFormat === "full"
                      ? isDarkTheme
                        ? "bg-white/15 text-white"
                        : "bg-[var(--emerald-subtle)] text-[var(--emerald-dark)]"
                      : isDarkTheme
                        ? "text-white/60 hover:bg-white/10"
                        : "text-[var(--ink-tertiary)] hover:bg-[var(--cream-dark)]"
                  }`}
                >
                  Full
                </button>
                <button
                  onClick={() => setLessonFormat("micro")}
                  className={`rounded-full px-3 py-1 text-[11px] ${
                    lessonFormat === "micro"
                      ? isDarkTheme
                        ? "bg-white/15 text-white"
                        : "bg-[var(--emerald-subtle)] text-[var(--emerald-dark)]"
                      : isDarkTheme
                        ? "text-white/60 hover:bg-white/10"
                        : "text-[var(--ink-tertiary)] hover:bg-[var(--cream-dark)]"
                  }`}
                >
                  Micro
                </button>
              </div>

              {lessonFormat === "micro" && (
                <label
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] ${
                    isDarkTheme
                      ? "border-white/10 bg-white/[0.03] text-white/70"
                      : "border-[var(--border)] bg-[var(--paper)] text-[var(--ink-secondary)]"
                  }`}
                >
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

            <p
              className={`mt-5 text-center text-[12px] ${
                isDarkTheme ? "text-white/35" : "text-[var(--ink-tertiary)]"
              }`}
            >
              Try: &ldquo;Find the derivative of f(x) = 3x^4 - 2x^2 + 7x - 5&rdquo;
            </p>

            {error && (
              <p
                className={`mt-3 text-center text-[12px] ${
                  isDarkTheme ? "text-[#fca5a5]" : "text-[var(--error)]"
                }`}
              >
                {error}
              </p>
            )}
          </section>
        </main>
      </div>
    );
  }

  if (isExamCramMode) {
    return (
      <div className={appFrameClass}>
        {profileMenu}
        {renderModeRail("exam-cram")}
        <main className={`mx-auto w-full max-w-6xl px-6 py-14 transition-[padding-left] duration-300 ease-out ${darkModeContentOffset}`}>
          <section className="mx-auto w-full max-w-4xl">
            <h1 className={`${modeTitleClass} text-[clamp(40px,6vw,64px)]`}>
              Prepare exam-first
            </h1>
            <p className={modeLeadClass}>
              Upload notes, old questions, or study guides. Doceo predicts likely topics and builds focused practice.
            </p>

            <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section className={modeCardClass}>
                <p className={`text-[11px] uppercase tracking-wide ${modeTextSubtleClass}`}>Input</p>

                <label className={`mt-3 block ${modeLabelClass}`}>
                  Exam name
                  <input
                    value={examName}
                    onChange={(event) => setExamName(event.target.value)}
                    placeholder="e.g. Calculus Midterm 2"
                    className={`mt-1.5 w-full px-3 py-2 text-[13px] outline-none transition-colors focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,0.25)] ${modeInputClass}`}
                  />
                </label>

                <label className={`mt-4 block ${modeLabelClass}`}>
                  Notes or copied materials
                  <textarea
                    value={examNotes}
                    onChange={(event) => setExamNotes(event.target.value)}
                    rows={7}
                    placeholder="Paste lecture summaries, question banks, or textbook snippets..."
                    className={`mt-1.5 w-full px-3 py-2.5 text-[13px] leading-relaxed outline-none transition-colors focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,0.25)] ${modeInputClass}`}
                  />
                </label>

                <div className={`mt-4 ${modeInnerCardClass}`}>
                  <label className={modeLabelClass}>
                    Upload files (.txt, .md, etc.)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={(event) =>
                      setExamFiles(Array.from(event.target.files || []))
                    }
                    className={`mt-2 block w-full text-[12px] file:mr-3 file:rounded-lg file:border file:px-3 file:py-1.5 file:text-[11px] ${modeFileInputClass}`}
                  />
                  {examFiles.length > 0 && (
                    <p className={`mt-2 text-[11px] ${modeTextMutedClass}`}>
                      {examFiles.length} file{examFiles.length > 1 ? "s" : ""} selected
                    </p>
                  )}
                </div>

                {examError && (
                  <p className={`mt-3 text-[12px] ${modeErrorClass}`}>{examError}</p>
                )}

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => void handleExamCramSubmit()}
                    disabled={!hasExamInput || examLoading}
                    className="inline-flex min-w-[190px] items-center justify-center gap-2 rounded-xl border border-[#22c55e]/60 bg-[#22c55e] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_0_0_0_rgba(34,197,94,0.25)] transition-all hover:bg-[#16a34a] hover:shadow-[0_0_0_4px_rgba(34,197,94,0.18)] focus-visible:shadow-[0_0_0_4px_rgba(34,197,94,0.22)] disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--cream-dark)] disabled:text-[var(--ink-faint)] disabled:shadow-none"
                  >
                    {examLoading ? <Spinner size={15} /> : null}
                    {examLoading ? "Generating..." : "Generate cram plan"}
                  </button>
                </div>
              </section>

              <section className={modeCardFlatClass}>
                <p className={`text-[11px] uppercase tracking-wide ${modeTextSubtleClass}`}>How it works</p>
                <div className={`mt-3 space-y-2 text-[13px] ${modeTextSecondaryClass}`}>
                  <p>1. Parse recurring patterns from your notes and past exam material.</p>
                  <p>2. Rank topics by likely exam relevance.</p>
                  <p>3. Build focused lessons and practice prompts from those topics.</p>
                </div>

                {examResult && examResult.recurring_patterns.length > 0 && (
                  <div className={`mt-5 border-t pt-4 ${isDarkTheme ? "border-white/10" : "border-[var(--border)]"}`}>
                    <p className={`text-[12px] font-medium ${modeTextBodyClass}`}>Recurring patterns</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {examResult.recurring_patterns.slice(0, 6).map((pattern, idx) => (
                        <span
                          key={`${pattern}-${idx}`}
                          className={modeChipClass}
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
                <section className={modeResultCardClass}>
                  <h3 className={`text-[16px] font-semibold ${modeTextStrongClass}`}>Prioritized Topics</h3>
                  <div className="mt-3 space-y-2">
                    {examResult.prioritized_topics.map((topic) => (
                      <div
                        key={topic.topic}
                        className={modeResultItemClass}
                      >
                        <p className={`text-[13px] font-medium ${modeTextStrongClass}`}>{topic.topic}</p>
                        <p className={`text-[11px] ${modeTextMutedClass}`}>
                          Priority score: {(topic.likelihood * 100).toFixed(0)} / 100
                        </p>
                        <p className={`mt-1 text-[12px] ${modeTextSecondaryClass}`}>{topic.why}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className={modeResultCardClass}>
                  <h3 className={`text-[16px] font-semibold ${modeTextStrongClass}`}>Practice Questions</h3>
                  <div className="mt-3 space-y-2">
                    {examResult.practice_questions.map((question, index) => (
                      <div
                        key={`${question.concept}-${index}`}
                        className={modeResultItemClass}
                      >
                        <p className={`text-[11px] ${modeTextMutedClass}`}>
                          {question.difficulty.toUpperCase()} • {question.concept}
                        </p>
                        <p className={`mt-1 text-[13px] ${modeTextBodyClass}`}>{question.question}</p>
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
      <div className={appFrameClass}>
        {profileMenu}
        {renderModeRail("courses")}
        <main className={`mx-auto w-full max-w-6xl px-6 py-14 transition-[padding-left] duration-300 ease-out ${darkModeContentOffset}`}>
          <section className="mx-auto w-full max-w-5xl">
            <h1 className={`${modeTitleClass} text-[clamp(40px,6vw,62px)]`}>
              Keep every course organized
            </h1>
            <p className={modeLeadClass}>
              Create course spaces, upload notes, and reopen saved lessons in one place.
            </p>

            <div className="mt-8 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <section className={modeCardClass}>
                <p className={`text-[11px] uppercase tracking-wide ${modeTextSubtleClass}`}>Courses</p>

                <div className="mt-3 flex gap-2">
                  <input
                    value={newCourseLabel}
                    onChange={(event) => setNewCourseLabel(event.target.value)}
                    placeholder="New course label"
                    className={`flex-1 px-3 py-2 text-[13px] outline-none transition-colors focus-visible:border-[#22c55e] focus-visible:shadow-[0_0_0_3px_rgba(34,197,94,0.25)] ${modeInputClass}`}
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
                    <p className={`text-[12px] ${modeTextMutedClass}`}>Loading courses...</p>
                  )}
                  {!coursesLoading && courses.length === 0 && (
                    <p className={`text-[12px] ${modeTextSubtleClass}`}>No course labels yet.</p>
                  )}

                  {courses.map((course) => {
                    const isSelected = course.course_id === courseId;
                    return (
                      <div
                        key={course.course_id}
                        className={`flex items-center gap-2 rounded-xl border p-2 ${
                          isDarkTheme
                            ? "border-white/10 bg-[#0d1420]"
                            : "border-[var(--border)] bg-[var(--paper-warm)]"
                        }`}
                      >
                        <button
                          onClick={() => setCourseId(course.course_id)}
                          className={`flex-1 rounded-lg px-2.5 py-2 text-left text-[12px] ${
                            isSelected
                              ? isDarkTheme
                                ? "bg-[#123021] text-[#8ef5b2]"
                                : "bg-[var(--emerald-subtle)] text-[var(--emerald-dark)]"
                              : isDarkTheme
                                ? "text-white/80 hover:bg-white/[0.06]"
                                : "text-[var(--ink-secondary)] hover:bg-[var(--cream-dark)]"
                          }`}
                        >
                          <span className="block truncate font-medium">{course.label}</span>
                          <span className={`text-[10px] ${modeTextSubtleClass}`}>
                            {course.material_count} files
                          </span>
                        </button>
                        <button
                          onClick={() => void handleDeleteCourse(course)}
                          className={`rounded-lg border px-2 py-1 text-[11px] transition-colors ${
                            isDarkTheme
                              ? "border-white/10 text-white/55 hover:border-white/20 hover:text-[#fca5a5]"
                              : "border-[var(--border)] text-[var(--ink-tertiary)] hover:border-[var(--border-strong)] hover:text-[var(--error)]"
                          }`}
                        >
                          Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className={modeCardFlatClass}>
                <p className={`text-[11px] uppercase tracking-wide ${modeTextSubtleClass}`}>Upload notes</p>
                <p className={`mt-2 text-[12px] ${modeTextSecondaryClass}`}>
                  Selected course: {selectedCourse ? selectedCourse.label : "None"}
                </p>

                <div className="mt-3 space-y-2">
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,.docx"
                    onChange={(event) => setNotesFile(event.target.files?.[0] ?? null)}
                    disabled={notesUploading}
                    className={`w-full text-[12px] file:mr-3 file:rounded-lg file:border file:px-3 file:py-1.5 file:text-[11px] ${modeFileInputClass}`}
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
                  <p className={`mt-3 text-[12px] ${modeTextMutedClass}`}>Loading materials...</p>
                )}
                {!materialsLoading && materials.length === 0 && (
                  <p className={`mt-3 text-[12px] ${modeTextSubtleClass}`}>No materials yet.</p>
                )}

                {materials.length > 0 && (
                  <div className="mt-3 max-h-[260px] space-y-2 overflow-y-auto">
                    {materials.map((material) => (
                      <div
                        key={material.material_id}
                        className={`rounded-xl border px-3 py-2.5 ${
                          isDarkTheme
                            ? "border-white/10 bg-[#0d1420]"
                            : "border-[var(--border)] bg-[var(--paper-warm)]"
                        }`}
                      >
                        <p className={`text-[12px] font-medium ${modeTextBodyClass}`}>
                          {material.filename}
                        </p>
                        <p className={`text-[11px] ${modeTextSubtleClass}`}>
                          {material.chunk_count} chunks • {material.char_count} chars
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className={`mt-5 ${modeCardFlatClass}`}>
              <h3 className={`text-[14px] font-semibold ${modeTextBodyClass}`}>Saved Lessons</h3>

              {lessonsLoading && (
                <p className={`mt-3 text-[12px] ${modeTextMutedClass}`}>Loading lessons...</p>
              )}
              {!lessonsLoading && lessons.length === 0 && (
                <p className={`mt-3 text-[12px] ${modeTextSubtleClass}`}>No lessons saved for this course yet.</p>
              )}

              {lessons.length > 0 && (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {lessons.map((lesson) => (
                    <button
                      key={lesson.session_id}
                      onClick={() => router.push(`/lesson/${lesson.session_id}`)}
                      className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        isDarkTheme
                          ? "border-white/10 bg-[#0d1420] hover:border-white/20 hover:bg-[#111b2a]"
                          : "border-[var(--border)] bg-[var(--paper-warm)] hover:border-[var(--border-strong)] hover:bg-[var(--cream-dark)]"
                      }`}
                    >
                      <p className={`truncate text-[12px] font-medium ${modeTextStrongClass}`}>{lesson.title}</p>
                      <p className={`text-[11px] ${modeTextMutedClass}`}>
                        {lesson.lesson_type === "micro" ? "Micro" : "Full"} • {lesson.subject} • {lesson.step_count} steps
                      </p>
                      <p className={`text-[11px] ${modeTextSubtleClass}`}>{formatLessonDate(lesson.created_at)}</p>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {courseError && <p className={`mt-4 text-[12px] ${modeErrorClass}`}>{courseError}</p>}
          </section>
        </main>
      </div>
    );
  }

  if (isHistoryMode) {
    return (
      <div className={appFrameClass}>
        {profileMenu}
        {renderModeRail("history")}
        <main className={`mx-auto w-full max-w-5xl px-6 py-14 transition-[padding-left] duration-300 ease-out ${darkModeContentOffset}`}>
          <h1 className={`${modeTitleClass} text-[clamp(40px,6vw,60px)]`}>
            Continue from where you left off
          </h1>
          <p className={modeLeadClass}>
            Reopen prior lessons and jump back into explanations, diagrams, and practice.
          </p>

          {historyLoading && (
            <p className={`mt-8 text-center text-[13px] ${modeTextMutedClass}`}>Loading history...</p>
          )}
          {historyError && (
            <p className={`mt-8 text-center text-[13px] ${modeErrorClass}`}>{historyError}</p>
          )}

          {!historyLoading && !historyError && historyItems.length === 0 && (
            <p className={`mt-8 text-center text-[13px] ${modeTextSubtleClass}`}>
              No prior sessions yet.
            </p>
          )}

          <div className="mt-8 space-y-3">
            {historyItems.map((item) => (
              <button
                key={item.session_id}
                onClick={() => router.push(`/lesson/${item.session_id}`)}
                className={`block w-full rounded-2xl border p-4 text-left transition-colors ${
                  isDarkTheme
                    ? "border-white/10 bg-[#151923] hover:border-white/20 hover:bg-[#101826]"
                    : "border-[var(--border)] bg-[var(--paper)] hover:border-[var(--border-strong)] hover:bg-[var(--paper-warm)]"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className={`text-[16px] font-medium ${modeTextStrongClass}`}>{item.title}</p>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      isDarkTheme
                        ? "border-white/10 bg-white/[0.03] text-white/60"
                        : "border-[var(--border)] bg-[var(--paper-warm)] text-[var(--ink-tertiary)]"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
                {item.problem_text && (
                  <p className={`mt-1 text-[13px] line-clamp-2 ${modeTextSecondaryClass}`}>
                    {item.problem_text}
                  </p>
                )}
                <p className={`mt-2 text-[12px] ${modeTextSubtleClass}`}>
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

  return null;
}
