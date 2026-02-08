"use client";

import { useState, useCallback } from "react";
import { createSession } from "@/lib/api";

const MAX_RETRIES = 2;
const RETRY_DELAY = 1500;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const COMPRESSION_THRESHOLD = 500 * 1024; // 500KB
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.8;

function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    if (file.size <= COMPRESSION_THRESHOLD) {
      resolve(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height / width) * MAX_DIMENSION);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width / height) * MAX_DIMENSION);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}

export function useUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);

  const submit = useCallback(async (): Promise<{ sessionId: string; loadingRunId: string } | null> => {
    if (!file && !text.trim()) {
      setError("Please upload an image or type a problem.");
      return null;
    }

    if (file && file.size > MAX_FILE_SIZE) {
      setError("File too large. Please upload an image under 10MB.");
      return null;
    }

    const runId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setLoading(true);
    setError(null);
    setLoadingRunId(runId);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        let sessionId: string;

        if (file) {
          const compressed = await compressImage(file);
          const formData = new FormData();
          formData.append("file", compressed);
          if (text.trim()) formData.append("problem_text", text.trim());
          const res = await createSession(formData);
          sessionId = res.session_id;
        } else {
          const res = await createSession({ problem_text: text.trim() });
          sessionId = res.session_id;
        }

        return { sessionId, loadingRunId: runId };
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Something went wrong");
        // Only retry on server errors, not client errors
        if (attempt < MAX_RETRIES && lastError.message.includes("Server error")) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
          continue;
        }
        break;
      }
    }

    setError(lastError?.message ?? "Something went wrong. Please try again.");
    setLoading(false);
    setLoadingRunId(null);
    return null;
  }, [file, text]);

  const reset = useCallback(() => {
    setFile(null);
    setText("");
    setError(null);
    setLoadingRunId(null);
  }, []);

  return { file, setFile, text, setText, loading, loadingRunId, error, submit, reset };
}
