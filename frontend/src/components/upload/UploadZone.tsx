"use client";

import { useCallback, useRef, useState } from "react";

interface UploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export default function UploadZone({ onFile, disabled }: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type.startsWith("image/")) onFile(file);
    },
    [onFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const file = e.clipboardData.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      onPaste={onPaste}
      onClick={() => inputRef.current?.click()}
      className={`
        relative group cursor-pointer
        border-2 border-dashed rounded-[var(--radius-lg)]
        px-8 py-12
        flex flex-col items-center justify-center gap-3
        transition-all duration-200
        ${
          isDragging
            ? "border-[var(--emerald)] bg-[var(--emerald-wash)]"
            : "border-[var(--border-strong)] hover:border-[var(--ink-faint)] bg-[var(--paper-warm)]"
        }
        ${disabled ? "opacity-50 pointer-events-none" : ""}
      `}
    >
      {/* Upload icon */}
      <div
        className={`
          w-10 h-10 rounded-full
          flex items-center justify-center
          transition-colors duration-200
          ${isDragging ? "bg-[var(--emerald-subtle)]" : "bg-[var(--cream-dark)] group-hover:bg-[var(--emerald-subtle)]"}
        `}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className={`transition-colors ${isDragging ? "text-[var(--emerald)]" : "text-[var(--ink-tertiary)] group-hover:text-[var(--emerald)]"}`}
        >
          <path
            d="M10 3v10M6 7l4-4 4 4M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="text-center">
        <p className="text-[14px] font-medium text-[var(--ink-secondary)]">
          Drop a screenshot here, or{" "}
          <span className="text-[var(--emerald)] underline underline-offset-2">
            browse
          </span>
        </p>
        <p className="text-[12px] text-[var(--ink-tertiary)] mt-1">
          PNG, JPG up to 10MB — or paste from clipboard
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
