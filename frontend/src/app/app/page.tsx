"use client";

import { useRouter } from "next/navigation";
import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useUpload } from "@/hooks/useUpload";
import Spinner from "@/components/ui/Spinner";
import LessonLoadingScreen from "@/components/ui/LoadingOverlay";
import AppNavbar from "@/components/nav/AppNavbar";

export default function Home() {
  const router = useRouter();
  const { file, setFile, text, setText, loading, loadingRunId, error, submit } = useUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const hasInput = !!file || text.trim().length > 0;

  // Properly manage blob URL lifecycle to prevent memory leaks
  const filePreviewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
    };
  }, [filePreviewUrl]);

  const handleSubmit = async () => {
    if (!hasInput || loading) return;
    const result = await submit();
    if (result?.sessionId) {
      const query = new URLSearchParams({ loadingRun: result.loadingRunId }).toString();
      router.push(`/lesson/${result.sessionId}?${query}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFile = useCallback(
    (f: File) => {
      if (f.type.startsWith("image/")) setFile(f);
    },
    [setFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const f = e.clipboardData.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  return (
    <div className="relative min-h-screen flex flex-col">
      <AppNavbar />

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-2xl"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Heading */}
          <div className="mb-10 text-center">
            <h1 className="font-[family-name:var(--font-heading)] text-[clamp(32px,5vw,48px)] font-bold leading-[1.1] text-[var(--ink)] mb-3">
              Learn step by step
            </h1>
            <p className="text-[var(--ink-secondary)] text-[16px] leading-relaxed max-w-md mx-auto font-[family-name:var(--font-body)] font-light">
              Type a STEM problem or paste a screenshot. Doceo turns it into an
              interactive walkthrough and explains every step clearly.
            </p>
          </div>

          {/* Chat-style input */}
          <div
            className={`
              relative rounded-2xl border transition-all duration-200
              bg-[var(--paper)] shadow-[var(--shadow-md)]
              ${isDragging
                ? "border-[var(--emerald-light)] bg-[var(--emerald-wash)]"
                : "border-[var(--border)]"
              }
              ${loading ? "opacity-70 pointer-events-none" : ""}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            {/* Image preview (if attached) */}
            <AnimatePresence>
              {file && filePreviewUrl && (
                <motion.div
                  className="px-4 pt-4"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="inline-flex items-center gap-3 p-2 bg-[var(--cream-dark)] rounded-lg border border-[var(--border)]">
                    <div className="relative w-14 h-14 rounded-md overflow-hidden border border-[var(--border)] flex-shrink-0">
                      <Image
                        src={filePreviewUrl}
                        alt="Attached problem"
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--ink)] truncate max-w-[180px]">
                        {file.name}
                      </p>
                      <p className="text-[11px] text-[var(--ink-tertiary)]">
                        {(file.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => setFile(null)}
                      className="p-1.5 rounded-md hover:bg-[var(--paper)] transition-colors text-[var(--ink-tertiary)] hover:text-[var(--ink)] cursor-pointer"
                      aria-label="Remove image"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M3 3l8 8M11 3l-8 8"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => { setText(e.target.value); autoResize(); }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={file ? "Add a description (optional)..." : "Type your problem, or paste/drop an image..."}
              rows={1}
              disabled={loading}
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
              className="
                w-full bg-transparent text-[var(--ink)]
                px-4 py-4
                text-[15px] font-[family-name:var(--font-body)]
                leading-relaxed
                placeholder:text-[var(--ink-faint)]
                focus:outline-none
                resize-none
                min-h-[52px] max-h-[200px]
              "
            />

            {/* Bottom bar: attach + send */}
            <div className="flex items-center justify-between px-3 pb-3">
              {/* Attach button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-lg hover:bg-[var(--cream-dark)] transition-colors text-[var(--ink-tertiary)] hover:text-[var(--ink)] cursor-pointer"
                aria-label="Attach image"
                title="Attach an image"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M17.5 10.625l-6.563 6.563a4.375 4.375 0 01-6.187-6.188l6.563-6.563a2.917 2.917 0 014.124 4.126L8.875 15.125a1.458 1.458 0 01-2.063-2.063L13.375 6.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {/* Send button */}
              <button
                onClick={handleSubmit}
                disabled={!hasInput || loading}
                className={`
                  p-2.5 rounded-xl transition-all duration-150 cursor-pointer
                  ${hasInput && !loading
                    ? "bg-[var(--emerald)] text-white hover:bg-[var(--emerald-dark)] shadow-sm"
                    : "bg-[var(--cream-dark)] text-[var(--ink-faint)] cursor-not-allowed"
                  }
                `}
                aria-label="Start lesson"
              >
                {loading ? (
                  <Spinner size={18} />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path
                      d="M3.75 9h10.5M9.75 4.5L14.25 9l-4.5 4.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p
                className="text-[13px] text-[var(--error)] font-[family-name:var(--font-body)] mt-3 text-center"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Suggestion */}
          <p className="text-center text-[12px] text-[var(--ink-faint)] mt-5 font-[family-name:var(--font-body)]">
            Try: &ldquo;Find the derivative of f(x) = 3x&sup4; &minus; 2x&sup2; + 7x &minus; 5&rdquo;
          </p>
        </motion.div>
      </main>

      {/* Full-screen loading overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <LessonLoadingScreen
              overlay
              persistKey={loadingRunId ?? "upload-pending"}
              phase="intake"
              buildStage="analysis"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
