"use client";

import Image from "next/image";
import { useMemo } from "react";

interface UploadPreviewProps {
  file: File;
  onRemove: () => void;
}

export default function UploadPreview({ file, onRemove }: UploadPreviewProps) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);

  return (
    <div className="relative inline-flex items-center gap-3 p-3 bg-[var(--paper-warm)] border border-[var(--border)] rounded-[var(--radius-md)]">
      <div className="relative w-16 h-16 rounded overflow-hidden border border-[var(--border)] flex-shrink-0">
        <Image
          src={url}
          alt="Uploaded problem"
          fill
          className="object-cover"
          unoptimized
        />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--ink)] truncate max-w-[200px]">
          {file.name}
        </p>
        <p className="text-[12px] text-[var(--ink-tertiary)]">
          {(file.size / 1024).toFixed(0)} KB
        </p>
      </div>
      <button
        onClick={onRemove}
        className="ml-2 p-1 rounded hover:bg-[var(--cream-dark)] transition-colors text-[var(--ink-tertiary)] hover:text-[var(--ink)]"
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
  );
}
