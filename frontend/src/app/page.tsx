"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { useUpload } from "@/hooks/useUpload";
import UploadZone from "@/components/upload/UploadZone";
import TextInputArea from "@/components/upload/TextInputArea";
import UploadPreview from "@/components/upload/UploadPreview";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";

type InputMode = "upload" | "type";

export default function Home() {
  const router = useRouter();
  const { file, setFile, text, setText, loading, error, submit } = useUpload();
  const [mode, setMode] = useState<InputMode>("type");

  const handleSubmit = async () => {
    const sessionId = await submit();
    if (sessionId) router.push(`/lesson/${sessionId}`);
  };

  const hasInput = !!file || text.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-[var(--border)]">
        <span className="font-[family-name:var(--font-heading)] text-[20px] font-semibold tracking-tight text-[var(--ink)]">
          Doceo
        </span>
        <span className="text-[12px] text-[var(--ink-tertiary)] tracking-wide uppercase font-[family-name:var(--font-body)]">
          AI Tutor
        </span>
      </nav>

      {/* Hero + Input */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          className="w-full max-w-xl"
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
              Paste a screenshot or type a STEM problem. Doceo breaks it down on
              a whiteboard and walks you through every step.
            </p>
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
                  <span>Analyzing...</span>
                </>
              ) : (
                "Start lesson"
              )}
            </Button>
          </div>

          <p className="text-center text-[12px] text-[var(--ink-faint)] mt-6 font-[family-name:var(--font-body)]">
            Try: &ldquo;Find the derivative of f(x) = 3x&sup4; &minus; 2x&sup2;
            + 7x &minus; 5&rdquo;
          </p>
        </motion.div>
      </main>
    </div>
  );
}
